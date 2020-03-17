const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');

const { BU } = require('base-util-jh');

const {
  dcmConfigModel: { nodeDataType },
} = require('../../module').di;

const AbstBlockManager = require('./AbstBlockManager');

require('./block.jsdoc');

class BlockManager extends AbstBlockManager {
  /**
   * @override
   * @param {blockConfig[]} blockConfigList
   */
  async setBlockTable(blockConfigList) {
    // BU.CLI('setBlockTable');
    const completeStorageList = [];

    blockConfigList.forEach(blockConfigInfo => {
      const { blockCategory } = blockConfigInfo;

      // Storage Category에 맞는 Storage가져옴
      let dataContainer = this.getDataContainer(blockCategory);

      // 없다면 새로 생성
      if (dataContainer === undefined) {
        dataContainer = {
          blockCategory,
          blockConfigInfo,
          troubleWhere: {},
          insertTroubleList: [],
          updateTroubleList: [],
          insertDataList: [],
          dataStorageList: [],
          refineDate: null,
        };

        this.dataContainerList.push(dataContainer);
      }

      completeStorageList.push(this.setDataStorageList(blockConfigInfo, dataContainer));
    });

    /** @type {dataContainerDBS[]} */
    const dataStorageList = await Promise.all(completeStorageList);
    return dataStorageList;
  }

  /**
   * DB Table 단위로 Storage 생성
   * @param {blockConfig} blockConfig 테이블 명
   * @param {dataContainerDBS} dataContainer
   */
  async setDataStorageList(blockConfig, dataContainer) {
    const { baseTableInfo, applyTableInfo, troubleTableInfo } = blockConfig;
    // 참조할 테이블 명, Table에서 식별 가능한 유일 키 컬럼, Table에서 명시한 Place Key 컬럼
    const {
      tableName,
      idKey,
      placeKey,
      placeClassKeyList = [],
      fromToKeyTableList,
    } = baseTableInfo;

    const { matchingList } = applyTableInfo;

    // 데이터 저장소에서 관리할 각 Place 객체 정보
    const { dataStorageList } = dataContainer;

    // 컨테이너에 공통으로 쓰일 data frame
    const baseDataFrame = {};
    matchingList.forEach(matchingInfo => {
      _.assign(baseDataFrame, { [matchingInfo.toKey]: null });
    });

    const baseTroubleFrame = {};

    /** @type {Object[]} */
    let tableRows = await this.biModule.getTable(tableName);

    /** @type {placeInfo[]} */
    let existPlaceList = this.controller.placeList;

    // PC ID 목록으로 필터링
    if (placeClassKeyList.length) {
      existPlaceList = _.filter(existPlaceList, placeInfo =>
        _.includes(placeClassKeyList, placeInfo.pc_target_id),
      );
    }

    // 해당 Site에 존재하는 tableRows만 필터링
    tableRows = _.intersectionBy(tableRows, existPlaceList, 'place_seq');

    if (!_.isEmpty(troubleTableInfo)) {
      const { fromToKeyTableList: trobleFromToList } = troubleTableInfo;

      trobleFromToList.forEach(fromToInfo => {
        _.set(dataContainer.troubleWhere, fromToInfo.toKey, _.map(tableRows, fromToInfo.fromKey));
      });
    }

    tableRows.forEach(tableRow => {
      // insertDataList 에서 사용될 기본 객체 정보 생성. baseFrame을 얕은 복사를 사용하여 객체 생성.
      const dataFrame = _.clone(baseDataFrame);
      const troubleFrame = _.clone(baseTroubleFrame);
      const frameList = _.isEmpty(troubleTableInfo) ? [dataFrame] : [dataFrame, troubleFrame];

      frameList.forEach(frame => {
        _.forEach(fromToKeyTableList, fromToKeyInfo => {
          const { fromKey, toKey } = fromToKeyInfo;
          _.set(frame, toKey, _.get(tableRow, fromKey, null));
        });
      });

      /** @type {dataStorageDBS} */
      const dataStorage = {
        id: _.get(tableRow, idKey),
        dataFrame,
        troubleFrame,
        placeSeq: _.get(tableRow, placeKey),
        nodeList: [],
        troubleList: [],
      };
      dataStorageList.push(dataStorage);
    });

    // Set Delay TEST
    // await Promise.delay(1000);
    return dataContainer;
  }

  /**
   * @override
   * dataContainer과 연관이 있는 place Node List를 세팅함.
   * @param {placeInfo[]} placeList
   */
  bindingPlaceList(placeList = []) {
    // 데이터 컨테이너 목록 순회 (block Category 목록만큼 순회)
    this.dataContainerList.forEach(dataContainer => {
      // 컨테이너에 포함되어 있는 저장소 목록 순회 ()
      const { dataStorageList } = dataContainer;
      dataStorageList.forEach(dataStorage => {
        const placeInfo = _.find(placeList, { place_seq: dataStorage.placeSeq });

        if (placeInfo === undefined) {
          dataStorage.nodeList = [];
        } else {
          dataStorage.nodeList = placeInfo.nodeList;
        }
      });
    });
    // BU.CLIN(this.dataContainerList[0]);
  }

  /**
   * @override
   * 지정한 카테고리의 모든 데이터를 순회하면서 db에 적용할 데이터를 정제함.
   * @param {string} blockCategory  장치 Type 'inverter', 'connector'
   * @param {Date=} refineDate 해당 카테고리를 정제한 시각. insertData에 저장이 됨
   */
  async refineDataContainer(blockCategory, refineDate = new Date()) {
    // BU.CLI('refineDataContainer', blockCategory);
    const dataContainer = this.getDataContainer(blockCategory);

    if (_.isEmpty(dataContainer)) {
      throw new Error(`There is no such device category. [${blockCategory}]`);
    }

    // 처리 시각 저장 및 각 list 초기화
    dataContainer.refineDate = refineDate;
    dataContainer.insertDataList = [];
    dataContainer.insertTroubleList = [];
    dataContainer.updateTroubleList = [];

    // 데이터 정제 처리
    this.processData(dataContainer);

    // 에러 내역을 정의한 컨테이너라면 Trouble 정제 처리
    if (!_.isEmpty(dataContainer.blockConfigInfo.troubleTableInfo)) {
      await this.processTrouble(dataContainer);
    }

    // BU.CLIN(dataContainer.insertDataList);
    return dataContainer;
  }

  /**
   * DB에 컨테이너 단위로 저장된 insertDataList, insertTroubleList, updateTroubleList를 적용
   * @param {string} blockCategory 카테고리 명
   * @return {dataContainerDBS}
   */
  async saveDataToDB(blockCategory) {
    const dataContainer = this.getDataContainer(blockCategory);

    if (_.isEmpty(dataContainer)) {
      throw new Error(`There is no such device category. [${blockCategory}]`);
    }

    // 블록 정보와 DB에 적용할 데이터
    const { blockConfigInfo, insertDataList, insertTroubleList, updateTroubleList } = dataContainer;
    // 데이터 Table 정보와 Trouble Table 정보
    const { applyTableInfo, troubleTableInfo } = blockConfigInfo;

    // BU.CLIS(insertDataList);

    // list 초기화
    dataContainer.insertDataList = [];
    dataContainer.insertTroubleList = [];
    dataContainer.updateTroubleList = [];

    // 저장하지 않고자 할 경우 실행하지 않음.
    if (!this.isSaveToDB) {
      return false;
    }

    // 삽입할 데이터와 Table이 존재한다면 삽입
    if (insertDataList.length && applyTableInfo.tableName) {
      await this.biModule.setTables(applyTableInfo.tableName, insertDataList);
    }

    // Trouble Table 정보가 존재한다면
    if (!_.isEmpty(troubleTableInfo)) {
      const { tableName, indexInfo } = troubleTableInfo;
      const { primaryKey } = indexInfo;

      // 입력할 Trouble Data가 있을 경우
      if (insertTroubleList.length) {
        await this.biModule.setTables(tableName, insertTroubleList, false);
      }

      // 수정할 Trouble이 있을 경우
      if (updateTroubleList.length) {
        await this.biModule.updateTablesByPool(tableName, primaryKey, updateTroubleList, false);
      }
    }
  }

  /**
   * 장치 카테고리에 맞는 타입을 가져옴
   * @param {string} blockCategory 장치 카테고리 'inverter', 'connector' ... etc
   * @return {dataContainerDBS}
   */
  getDataContainer(blockCategory) {
    // BU.CLI('getDataContainer')
    // BU.CLIN(this.dataContainerList, 2);
    return _.find(this.dataContainerList, {
      blockCategory,
    });
  }

  /**
   * @private
   * 컨테이너 안에 포함되어 있는 저장소 목록을 순회하면서 nodeList를 의미있는 InsertData 객체로 변환 후 insertDataList에 삽입.
   * @param {dataContainerDBS} dataContainer
   */
  processData(dataContainer) {
    // BU.CLIN(dataContainer.dataStorageList);
    const { refineDate, dataStorageList, blockConfigInfo, insertDataList } = dataContainer;

    const { applyTableInfo } = blockConfigInfo;
    const { insertDateColumn, matchingList } = applyTableInfo;

    // dataStorageList를 순회하면서 nodeList의 데이터 유효성 검증(refineDate 기반)
    // 유효성이 검증되면 dataInfo에 nd_target_id 값과 동일한 곳에 데이터 삽입
    dataStorageList.forEach(dataStorage => {
      const { nodeList, dataFrame } = dataStorage;

      // 입력할 데이터 객체 생성
      const dataInfo = _.clone(dataFrame);

      // 날짜 형식을 사용한다면 DB에 입력할 정제 시간을 기록
      _.isString(insertDateColumn) &&
        insertDateColumn.length &&
        _.set(dataInfo, [insertDateColumn], refineDate);

      // nodeList 데이터 갱신 날짜와 refineDate의 간격 차가 스케줄러 오차 안에 들어오는 대상 필터링
      const filterdNodeList = this.controller.model.checkValidateNodeData(
        nodeList,
        _.get(this.controller, 'config.inquirySchedulerInfo.validInfo'),
        moment(refineDate),
      );

      // nodeList의 데이터 유효성 체크 진행
      const existNodeList = _.filter(filterdNodeList, nodeInfo => !_.isNil(nodeInfo.data));

      // nodeList 중에서 1개라도 유효한 데이터가 있을 경우에만 insert 목록으로 처리
      if (existNodeList.length) {
        // 실제 삽입 여부
        let isInsert = false;
        // 필터링 된 NodeList에서 nd_target_id가 dataInfo에 존재할 경우 해당 값 정의
        existNodeList.forEach(nodeInfo => {
          const { nd_target_id: ndId, data } = nodeInfo;

          // 데이터가 유효할 경우에만 세팅
          const matchingInfo = _.find(matchingList, { fromKey: ndId });
          // 매칭 정보가 있을 경우 데이터 변환처리 후 정의
          if (matchingInfo !== undefined) {
            // 1개라도 매칭 정보가 있다면 Insert Flag Tre
            isInsert = true;
            const { calculate = 1, toFixed = 1, toKey } = matchingInfo;
            _.set(dataInfo, toKey, _.round(_.multiply(data, calculate), toFixed));
          }
        });

        // nodeList 단위로 유효성 검증이 종료되면 dataInfo를 dataContainer.insertDataList 추가
        isInsert && insertDataList.push(dataInfo);
      }
    });
  }

  /**
   * @private
   * Device Error 처리. 신규 에러라면 insert, 기존 에러라면 dbTroubleList에서 해당 에러 삭제, 최종으로 남아있는 에러는 update
   * @param {dataContainerDBS} dataContainer
   */
  async processTrouble(dataContainer) {
    // BU.CLIS('processTrouble');
    const {
      refineDate,
      troubleWhere,
      insertTroubleList,
      updateTroubleList,
      dataStorageList,
      blockConfigInfo,
    } = dataContainer;

    // BU.CLIN(dataContainer, 2);

    const { troubleTableInfo } = blockConfigInfo;
    const { changeColumnKeyInfo } = troubleTableInfo;
    const { codeKey, fixDateKey, isErrorKey, msgKey, occurDateKey } = changeColumnKeyInfo;

    /**
     * DB 상에서 해결되지 못한 Trouble 목록을 가져옴
     * @type {Object[]}
     */
    const remainTroubleRows = await this.getTroubleList(troubleTableInfo, troubleWhere);

    dataStorageList.forEach(dataStorage => {
      const { nodeList, troubleFrame } = dataStorage;

      // 원천 Table 정보를 지닌 troubleFrame 복사
      // ex) inverter_seq 등을 가진 객체(toKey를 가짐)
      const troubleHeader = _.clone(troubleFrame);

      // save_db_type 값이 TROUBLE인 대상은 오류 내역
      /** @type {nodeInfo} */
      const troubleNode = _.find(nodeList, { save_db_type: nodeDataType.TROUBLE });

      // trouble Node 가 존재하지 않는다면 해당 Place에는 Trouble Node가 없다고 판단
      if (_.isObject(troubleNode)) {
        // nodeList 데이터 갱신 날짜와 refineDate의 간격 차가 스케줄러 오차 안에 들어오는 대상 필터링
        const filterdNodeList = this.controller.model.checkValidateNodeData(
          [troubleNode],
          _.get(this.controller, 'config.inquirySchedulerInfo.validInfo'),
          moment(refineDate),
        );

        // 배열이 존재한다는 것은 에러의 데이터가 유효하다는 것
        /** @type {troubleInfo[]} */
        let currTroubleList = [];
        if (filterdNodeList.length) {
          currTroubleList = _.get(troubleNode, 'data', []);
        }

        // 현재 오류 내역 목록을 순회하면서 DB에서 존재하는 trouble과 비교하고
        // insert, trouble, update 목록을 구성
        currTroubleList.forEach(troubleInfo => {
          // 남아있는 DB Trouble Rows 에서 동일한 에러가 있는지 체크. 있다면 query가 필요치 않으므로 제거.
          /** @type {Object[]} */
          const deletedTroubleRows = _.remove(remainTroubleRows, remainTroubleRow => {
            // code 가 같다면 설정 변수 값이 같은지 확인하여 모두 동일하다면 해당 에러 삭제
            if (remainTroubleRow.code === troubleInfo.code) {
              return _.every(troubleHeader, (v, k) => _.eq(v, remainTroubleRow[k]));
            }
          });

          // 삭제한 Rows 가 존재하지 않는다면 신규 에러
          if (!deletedTroubleRows.length) {
            const newTroubleInfo = {
              [isErrorKey]: troubleInfo.isError,
              [codeKey]: troubleInfo.code,
              [msgKey]: troubleInfo.msg,
              // nodeInfo 에서 갱신된 시간을 가져옴
              [occurDateKey]: troubleNode.writeDate,
              [fixDateKey]: null,
            };

            // 데이터외에 추가적으로 삽입할 Trouble Header를 결합하고 Insert Trouble 목록에 삽입
            insertTroubleList.push(_.assign(_.clone(troubleHeader), newTroubleInfo));
          }
        });
      }
    });

    // 남아있는 에러는 수정되었다고 처리
    remainTroubleRows.forEach(remainTroubleRow => {
      // 수정일은 데이터 갱신일로 처리
      remainTroubleRow[fixDateKey] = dataContainer.refineDate;

      updateTroubleList.push(remainTroubleRow);
    });

    // BU.CLIS(insertTroubleList, updateTroubleList);
  }

  /**
   * @protected 색다르게 필요하다면 구현
   * Block Category
   * Trouble 형식 --> {${id}, ${seq}, code, msg, occur_date, fix_date}
   * @param {troubleTableInfo} troubleTableInfo deviceDataList 요소. 시퀀스 와 측정 날짜
   * @param {Object} troubleWhere
   */
  getTroubleList(troubleTableInfo, troubleWhere = {}) {
    try {
      // DB 접속 정보가 없다면 에러
      if (_.isEmpty(this.biModule)) {
        throw new Error('DB information does not exist.');
      }

      const { tableName, changeColumnKeyInfo, indexInfo } = troubleTableInfo;
      const { codeKey, fixDateKey } = changeColumnKeyInfo;
      const { foreignKey, primaryKey } = indexInfo;

      // 에러를 선택해서 가져온다면 추가로 쿼리 생성
      let subSql = '';
      if (!_.isEmpty(troubleWhere)) {
        _.forEach(troubleWhere, (value, key) => {
          if (_.isEmpty(value)) {
            throw new Error(`key: ${key} values is empty.`);
          }
          subSql = subSql.concat(` AND originTbl.${key} IN (${value})`);
        });
      }

      const sql = `
      SELECT originTbl.*
      FROM ${tableName} originTbl
      LEFT JOIN ${tableName} joinTbl
       ON originTbl.${codeKey} = joinTbl.${codeKey} AND originTbl.${primaryKey} < joinTbl.${primaryKey}
       ${foreignKey ? ` AND originTbl.${foreignKey} = joinTbl.${foreignKey} ` : ''}
      WHERE joinTbl.${primaryKey} is NULL AND originTbl.${fixDateKey} is NULL
       ${subSql}
      ORDER BY originTbl.${primaryKey} ASC
    `;

      return this.biModule.db.single(sql, null, false);
    } catch (error) {
      return [];
    }
  }
}
module.exports = BlockManager;
