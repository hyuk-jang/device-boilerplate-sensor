const _ = require('lodash');
const moment = require('moment');

const Promise = require('bluebird');

const { BU } = require('base-util-jh');

const AbstBlockManager = require('./AbstBlockManager');

require('./block.config');

class BlockManager extends AbstBlockManager {
  /**
   * @override
   * @param {blockConfig[]} blockConfigList
   */
  async setBlockTable(blockConfigList) {
    BU.CLI('setDeviceForDB');
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
    const { tableName, idKey, placeKey, fromToKeyTableList } = baseTableInfo;

    const { matchingList } = applyTableInfo;

    // 데이터 저장소에서 관리할 각 Place 객체 정보
    const { dataStorageList } = dataContainer;

    // 컨테이너에 공통으로 쓰일 data frame
    const baseDataFrame = {};
    matchingList.forEach(matchingInfo => {
      _.assign(baseDataFrame, { [matchingInfo.fromKey]: null });
    });

    const baseTroubleFrame = {};

    /** @type {Object[]} */
    const tableRows = await this.biModule.getTable(tableName);

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
        convertedNodeData: {},
        measureDate: null,
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

  // TODO: category 시 정제 처리
  // insertTroubleList: [], updateTroubleList: [], insertDataList: [] 생성
  /**
   * @override
   * 지정한 카테고리의 모든 데이터를 순회하면서 db에 적용할 데이터를 정제함.
   * @param {string} blockCategory  장치 Type 'inverter', 'connector'
   * @param {Date=} refineDate 해당 카테고리를 정제한 시각. insertData에 저장이 됨
   * @param {boolean} isIgnoreError 에러를 무시하고 insertData 구문을 실행할 지 여부. default: false
   */
  async refineDataContainer(blockCategory, refineDate = new Date(), isIgnoreError = false) {
    BU.CLI('refineDataContainer', blockCategory);
    const dataContainer = this.getDataContainer(blockCategory);

    if (_.isEmpty(dataContainer)) {
      throw new Error(`There is no such device category. [${blockCategory}]`);
    }

    // 처리 시각 저장
    dataContainer.refineDate = refineDate;

    const { blockConfigInfo, dataStorageList } = dataContainer;
    const { applyTableInfo, baseTableInfo, troubleTableInfo } = blockConfigInfo;
    const { tableName, insertDateColumn, matchingList = [] } = applyTableInfo;

    // 각 list 초기화
    _.set(dataContainer, 'insertDataList', []);
    _.set(dataContainer, 'updateTroubleList', []);
    _.set(dataContainer, 'insertTroubleList', []);

    // dataStorageList를 순회하면서 nodeList의 데이터 유효성 검증(refineDate 기반)
    // 유효성이 검증되면 dataInfo에 nd_target_id 값과 동일한 곳에 데이터 삽입
    dataStorageList.forEach(dataStorage => {
      const { nodeList, dataFrame } = dataStorage;

      // 입력할 데이터 객체 생성
      const dataInfo = _.clone(dataFrame);

      // 날짜를 사용한다면 삽입
      _.isString(insertDateColumn) &&
        insertDateColumn.length &&
        _.set(dataInfo, [insertDateColumn], refineDate);

      // nodeList 데이터 갱신 날짜와 refineDate의 간격 차가 스케줄러 오차 안에 들어오는 대상 필터링
      const filterdNodeList = this.controller.model.checkValidateNodeData(
        nodeList,
        _.get(this.controller, 'config.inquirySchedulerInfo.validInfo'),
        moment(refineDate),
      );

      // 필터링 된 NodeList에서 nd_target_id가 dataInfo에 존재할 경우 해당 값 정의
      filterdNodeList.forEach(nodeInfo => {
        _.has(dataInfo, nodeInfo.nd_target_id) &&
          _.set(dataInfo, nodeInfo.nd_target_id, nodeInfo.data);
      });

      // nodeList 단위로 유효성 검증이 종료되면 dataInfo를 dataContainer.insertDataList 추가
      dataContainer.insertDataList.push(dataInfo);
    });

    // 에러 내역을 삽입할 경우
    if (!_.isEmpty(troubleTableInfo)) {
      await this.processTrouble(dataContainer);
    }

    // BU.CLIN(dataContainer.insertDataList);
  }

  /**
   * 장치 카테고리에 맞는 타입을 가져옴
   * @param {string} blockCategory 장치 카테고리 'inverter', 'connector' ... etc
   * @return {dataContainerDBS}
   */
  getDataContainer(blockCategory) {
    // BU.CLIN(this.dataContainerList, 3);
    return _.find(this.dataContainerList, {
      blockCategory,
    });
  }

  /**
   * @private
   * Device Error 처리. 신규 에러라면 insert, 기존 에러라면 dbTroubleList에서 해당 에러 삭제, 최종으로 남아있는 에러는 update
   * @param {dataContainerDBS} dataContainer
   * @param {dbTroubleRow[]} dbTroubleRows DB에서 가져온 trouble list.
   */
  async processTrouble(dataContainer) {
    BU.CLIS('processTrouble');
    const {
      refineDate,
      insertTroubleList,
      updateTroubleList,
      dataStorageList,
      blockConfigInfo,
    } = dataContainer;

    const { troubleTableInfo } = blockConfigInfo;

    const { tableName, insertDateColumn } = troubleTableInfo;

    // DB 상에서 해결되지 못한 Trouble 목록을 가져옴
    const remainTroubleRows = await this.getTroubleList(troubleTableInfo);

    dataStorageList.forEach(dataStorage => {
      const { nodeList, troubleFrame } = dataStorage;

      // 입력할 데이터 객체 생성
      const troubleData = _.clone(troubleFrame);

      // is_sensor 값이 3인 대상은 오류 내역
      const troubleNode = _.find(nodeList, { is_sensor: 3 });

      if (_.isObject) {
        // nodeList 데이터 갱신 날짜와 refineDate의 간격 차가 스케줄러 오차 안에 들어오는 대상 필터링
        const filterdNodeList = this.controller.model.checkValidateNodeData(
          [troubleNode],
          _.get(this.controller, 'config.inquirySchedulerInfo.validInfo'),
          moment(refineDate),
        );

        // 배열이 존재한다는 것은 에러의 데이터가 유효하다는 것
        /** @type {troubleInfo[]} */
        let troubleList = [];
        if (filterdNodeList.length) {
          troubleList = _.head(filterdNodeList);
        }

        troubleList.forEach(troubleInfo => {
          let hasExitError = false;
          _.remove(remainTroubleRows, remainTroubleRow => {
            // code 가 같다면 설정 변수 값이 같은지 확인하여 모두 동일하다면 해당 에러 삭제
            if (remainTroubleRow.code === troubleInfo.code) {
              // TroubleTableInfo의 AddParam에 명시된 값과 dataStorage의 config Key 값들이 전부 일치 한다면 동일 에러라고 판단
              const everyMatching = _.every(
                troubleTableInfo.fromToKeyTableList,
                fromToKeyInfo =>
                remainTroubleRow[fromToKeyInfo.toKey] === dataStorage.config[fromToKeyInfo.fromKey],
              );
              if (everyMatching) {
                hasExitError = true;
              }
              return false;
            }
            // new Error
            return false;
          })

        })


        



        

        
      }

      // BU.CLI(troubleNode);
    });
  }

  /**
   * @protected 색다르게 필요하다면 구현
   * Block Category
   * Trouble 형식 --> {${id}, ${seq}, code, msg, occur_date, fix_date}
   * @param {troubleTableInfo} troubleTableInfo deviceDataList 요소. 시퀀스 와 측정 날짜
   */
  getTroubleList(troubleTableInfo) {
    // DB 접속 정보가 없다면 에러
    if (_.isEmpty(this.biModule)) {
      throw new Error('DB information does not exist.');
    }

    const { tableName, changeColumnKeyInfo, indexInfo } = troubleTableInfo;
    const { codeKey, fixDateKey } = changeColumnKeyInfo;
    const { foreignKey, primaryKey } = indexInfo;

    const sql = `
      SELECT originTbl.*
        FROM ${tableName} originTbl
          LEFT JOIN ${tableName} joinTbl
              ON originTbl.${codeKey} = joinTbl.${codeKey} AND originTbl.${primaryKey} < joinTbl.${primaryKey}
      ${foreignKey ? ` AND  originTbl.${foreignKey} = joinTbl.${foreignKey} ` : ''}
        WHERE joinTbl.${primaryKey} is NULL AND originTbl.${fixDateKey} is NULL
        ORDER BY originTbl.${primaryKey} ASC
    `;

    return this.biModule.db.single(sql, null, true);
  }
}
module.exports = BlockManager;
