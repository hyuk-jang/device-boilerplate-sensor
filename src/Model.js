const _ = require('lodash');
const moment = require('moment');

const { BU } = require('base-util-jh');
const { BM } = require('base-model-jh');

const ControlDBS = require('./Control');

const CmdManager = require('./core/CommandManager/AbstCmdManager');

const { dcmWsModel, dcmConfigModel } = require('../../default-intelligence');

const {
  complexCmdStep,
  nodePickKey,
  complexCmdPickKey,
  controlModeInfo,
  goalDataRange,
  nodeDataType,
  reqWrapCmdType,
} = dcmConfigModel;

// API Server 와 데이터를 주고 받는 타입
const { transmitToServerCommandType, transmitToClientCommandType } = dcmWsModel;

class Model {
  /**
   * Creates an instance of Model.
   * @param {ControlDBS} controller
   * @memberof Model
   */
  constructor(controller) {
    this.controller = controller;

    const { config, dataLoggerControllerList, dataLoggerList, nodeList, placeList } = controller;

    this.dataLoggerControllerList = dataLoggerControllerList;
    this.dataLoggerList = dataLoggerList;
    this.nodeList = nodeList;
    this.placeList = placeList;

    /** @type {complexCmdWrapInfo[]} 복합 명령 실행 목록 */
    this.complexCmdList = [];

    this.biModule = new BM(config.dbInfo);

    /** @type {CmdManager} */
    this.cmdManager;

    // 정기 조회 Count
    this.inquirySchedulerIntervalSaveCnt = _.get(config, 'inquirySchedulerInfo.intervalSaveCnt', 1);
    this.inquirySchedulerCurrCount = 0;

    this.deviceMap = controller.deviceMap;

    // BU.CLIN(this.deviceMap, 1);

    // FIXME: 임시로 자동 명령 리스트 넣어둠. DB에서 가져오는 걸로 수정해야함(2018-07-30)
    this.excuteControlList = _.get(this.deviceMap, 'controlInfo.tempControlList', []);

    this.init();
  }

  /** Model 상세 초기화 */
  init() {
    this.initCommand();
    this.initOverapControlNode();
  }

  /**
   * @desc O.C
   * Overlap Control Storage List 초기화
   */
  initOverapControlNode() {
    // 노드 목록 중 장치만을 누적 제어 카운팅 목록으로 만듬

    // /** @type {csOverlapControlInfo[]} 실제 진행중인 누적 명령만을 가진 목록 */
    // this.processOverlapControlList = [];

    /** @type {csOverlapControlStorage[]} */
    this.overlapControlStorageList = _(this.nodeList)
      .filter(nodeInfo => _.eq(nodeInfo.is_sensor, 0))
      .map(nodeInfo => ({
        nodeInfo,
        overlapControlList: [],
      }))
      .value();
  }

  /**
   * 명령 제어 내용 초기화
   * 1. 단순 명령 시작지, 도착지 명 한글화
   * 2. 단순 명령 ID 코드 생성(srcPlaceId_TO_destPlaceId)
   */
  initCommand() {
    const {
      controlInfo: { flowCmdList, setCmdList },
    } = this.deviceMap;

    // 단순 명령을 쉽게 인식하기 위한 한글 명령을 입력
    flowCmdList.forEach(simpleCommandInfo => {
      const { srcPlaceId } = simpleCommandInfo;

      // 시작지 한글 이름
      const srcPlaceName = _.chain(this.placeList)
        .find({ place_id: srcPlaceId })
        .get('place_name')
        .value();

      _.set(simpleCommandInfo, 'srcPlaceName', srcPlaceName);

      simpleCommandInfo.destList.forEach(scDesInfo => {
        const { destPlaceId } = scDesInfo;

        // 도착지 한글 이름
        const destPlaceName = _.chain(this.placeList)
          .find({ place_id: destPlaceId })
          .get('place_name')
          .value();

        _.set(simpleCommandInfo, 'destPlaceName', srcPlaceName);
        // 한글 명령
        _.set(scDesInfo, 'cmdId', `${srcPlaceId}_TO_${destPlaceId}`);
        _.set(scDesInfo, 'cmdName', `${srcPlaceName} → ${destPlaceName}`);
      });
    });

    // BU.CLI(flowCmdList);

    const mapCmdInfo = {
      /** @type {flowCmdInfo[]} */
      flowCmdList,
      setCmdList,
    };

    this.mapCmdInfo = mapCmdInfo;
  }

  /**
   * FIXME: TEMP
   * @desc O.C
   * 해당 장치에 대한 동일한 제어가 존재하는지 체크
   * @param {csOverlapControlHandleConfig} existControlInfo 누적 제어 조회 옵션
   * @return {boolean} 현재 값과 동일하거나 예약 명령이 존재할 경우 True, 아니라면 False
   */
  isExistSingleControl(existControlInfo) {
    // BU.CLI(existControlInfo);
    const { nodeId, singleControlType, controlSetValue } = existControlInfo;

    // 노드 Id가 동일한 노드 객체 가져옴
    const nodeInfo = _.find(this.nodeList, { node_id: nodeId });

    // 만약 노드 객체가 없다면 해당 노드에 관해서 명령 생성하지 않음.
    if (_.isEmpty(nodeInfo)) return true;

    // 설정 제어 값이 존재하고 현재 노드 값과 같다면 추가적으로 제어하지 않음
    // FIXME: ControlSetValue와 설정 제어 값을 치환할 경우 상이한 문제가 발생할 것으로 보임. 필요시 수정
    if (!_.isNil(controlSetValue) && _.eq(nodeInfo.data, controlSetValue)) return true;

    // 사용자가 알 수 있는 제어 구문으로 변경
    const cmdName = this.convertControlValueToString(nodeInfo, singleControlType);

    // node 현재 값과 동일하다면 제어 요청하지 않음
    if (_.isNil(controlSetValue) && _.eq(_.lowerCase(nodeInfo.data), _.lowerCase(cmdName))) {
      return true;
    }

    // 저장소가 존재한다면 OC가 존재하는지 체크
    const overlapControlInfo = this.cmdManager.findOverlapControlNode(existControlInfo);

    // BU.CLI(overlapControlInfo);

    // OC가 존재하지 않는다면 실행 중이지 않음
    if (_.isEmpty(overlapControlInfo)) return false;

    // Wrap Command UUID가 지정되어 있다면 True, 아니라면 False
    return !!overlapControlInfo.reservedExecUU.length;
  }

  /**
   *
   * @param {Object} reqFlowCmd
   * @param {string=} reqFlowCmd.srcPlaceId 시작 장소 ID
   * @param {string=} reqFlowCmd.destPlaceId 목적지 장소 Id
   * @param {string=} reqFlowCmd.cmdId 명령 이름 영어(srcPlaceId_TO_destPlaceId)
   * @return {flowCmdDestInfo} 데이터를 찾을 경우. 아니라면 undefined
   */
  findFlowCommand(reqFlowCmd) {
    const { cmdId = '', srcPlaceId = '', destPlaceId = '' } = reqFlowCmd;
    // 명령 Full ID로 찾고자 할 경우
    if (cmdId.length) {
      return _(this.mapCmdInfo.flowCmdList)
        .map('destList')
        .flatten()
        .find({ cmdId });
    }

    // 시작지와 목적지가 있을 경우
    if (srcPlaceId.length && destPlaceId.length) {
      const flowCmdInfo = _.find(this.mapCmdInfo.flowCmdList, { srcPlaceId });
      if (flowCmdInfo !== undefined) {
        return _.find(flowCmdInfo.destList, { destPlaceId });
      }
    }
  }

  /**
   * @abstract
   * @param {nodeInfo} nodeInfo
   * @param {string} singleControlType
   */
  convertControlValueToString(nodeInfo, singleControlType) {
    return this.cmdManager.convertControlValueToString(nodeInfo, singleControlType);
  }

  /**
   * API 서버로 축약해서 명령을 보냄.
   */
  transmitComplexCommandStatus() {
    const contractCommandList = _(this.complexCmdList)
      .map(complexCmdInfo => _.pick(complexCmdInfo, complexCmdPickKey.FOR_SERVER))
      .value();

    // 업데이트 알림 (통째로 보내버림)
    this.controller.apiClient.transmitDataToServer({
      commandType: transmitToServerCommandType.COMMAND,
      data: contractCommandList,
    });
  }

  /**
   * Data logger와 연결되어 있는 컨트롤러를 반환
   * @param {dataLoggerInfo|string} searchValue string: dl_id, node_id or Object: DataLogger
   */
  findDataLoggerController(searchValue) {
    // BU.CLI(searchValue);
    // Node Id 일 경우
    if (_.isString(searchValue)) {
      // Data Logger List에서 찾아봄
      // BU.CLIN(this.dataLoggerList);
      const dataLoggerInfo = _.find(this.dataLoggerList, {
        dl_id: searchValue,
      });

      if (dataLoggerInfo) {
        searchValue = dataLoggerInfo;
      } else {
        // 없다면 노드에서 찾아봄
        const nodeInfo = _.find(this.nodeList, {
          node_id: searchValue,
        });
        // string 인데 못 찾았다면 존재하지 않음. 예외 발생
        if (_.isEmpty(nodeInfo)) {
          throw new Error(`Node ID: ${searchValue} is not exist`);
        }
        searchValue = nodeInfo.getDataLogger();
      }
    }

    // BU.CLIN(this.dataLoggerControllerList);
    return _.find(this.dataLoggerControllerList, router =>
      _.isEqual(router.dataLoggerInfo, searchValue),
    );
  }

  /**
   * 복합 명령을 저장
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdWrapInfo}
   */
  saveComplexCommand(complexCmdWrapInfo) {
    // BU.CLIN(complexCmdWrapInfo, 1);
    try {
      this.cmdManager.saveComplexCommand(complexCmdWrapInfo);

      this.transmitComplexCommandStatus();

      return complexCmdWrapInfo;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 저장소 데이터 관리. Data Logger Controller 객체로 부터 Message를 받은 경우 msgCode에 따라서 관리
   * @example
   * Device Client로부터 Message 수신
   * @param {DataLoggerControl} dataLoggerController Data Logger Controller 객체
   * @param {dcMessage} dcMessage 명령 수행 결과 데이터
   */
  manageComplexCommand(dataLoggerController, dcMessage) {
    try {
      this.cmdManager.manageComplexCommand(dataLoggerController, dcMessage);
    } catch (error) {
      throw error;
    }
  }

  /** 정기 계측 조회 명령 완료 결과 반영 */
  async completeInquiryDeviceStatus() {
    process.env.LOG_DBS_INQUIRY_COMPLETE === '1' &&
      BU.CLI(`${this.controller.mainUUID} Comlete inquiry`);

    // 정기 계측 카운팅 증가
    this.inquirySchedulerCurrCount += 1;

    // 정기 계측 저장 간격 수와 현재 수행된 정기 계측 명령 수가 같지 않다면 데이터 저장 X
    // 1분당 간격이 아닌 더 적은 인터벌 계측이 이루어 질 경우
    if (this.inquirySchedulerIntervalSaveCnt !== this.inquirySchedulerCurrCount) {
      return false;
    }

    // 현재 정기 계측된 카운팅 초기화
    this.inquirySchedulerCurrCount = 0;

    // 데이터의 유효성을 인정받는 Node List
    const validNodeList = this.checkValidateNodeData(
      this.nodeList,
      _.get(this, 'config.inquirySchedulerInfo.validInfo'),
      this.controller.inquirySchedulerRunMoment,
      // momentDate.format('YYYY-MM-DD HH:mm:ss'),
    );

    // BU.CLIN(validNodeList);
    process.env.LOG_DBS_INQUIRY_RESULT === '1' &&
      BU.CLI(this.getAllNodeStatus(nodePickKey.FOR_DATA));

    await this.insertNodeDataToDB(validNodeList, {
      hasSensor: process.env.DBS_SAVE_SENSOR !== '0',
      hasDevice: process.env.DBS_SAVE_DEVICE !== '0',
    });
  }

  /**
   * 모든 노드가 가지고 있는 정보 출력
   * @param {nodePickKey} nodePickKeyList
   * @param {nodeInfo[]=} nodeList
   * @param {number[]=} targetSensorRange 보내고자 하는 센서 범위를 결정하고 필요 데이터만을 정리하여 반환
   */
  getAllNodeStatus(nodePickKeyList = nodePickKey.FOR_SERVER, nodeList = this.nodeList) {
    const orderKey = _.includes(nodePickKeyList, 'node_id') ? 'node_id' : _.head(nodePickKeyList);

    const statusList = _(nodeList)
      .map(nodeInfo => {
        if (nodePickKeyList) {
          return _.pick(nodeInfo, nodePickKeyList);
        }
        return nodeInfo;
      })
      .orderBy(orderKey)
      .value();
    // BU.CLI(statusList);
    return statusList;
  }

  /**
   * 노드 리스트 중 입력된 날짜를 기준으로 유효성을 가진 데이터만 반환
   * @param {nodeInfo[]} nodeList
   * @param {timeIntervalToValidateInfo} diffInfo
   * @param {moment.Moment} momentDate
   * @return {nodeInfo[]}
   */
  checkValidateNodeData(
    nodeList,
    diffInfo = { diffType: 'minutes', duration: 1 },
    momentDate = moment(),
  ) {
    // 입력된 노드 리스트를 돌면서 유효성 검증
    return nodeList.filter(nodeInfo => {
      // 날짜 차 계산
      const diffNum = momentDate.diff(moment(nodeInfo.writeDate), diffInfo.diffType);
      // 날짜 차가 허용 범위를 넘어섰다면 유효하지 않는 데이터
      if (diffNum > diffInfo.duration) {
        // BU.CLI(
        //   `${
        //     nodeInfo.node_id
        //   }는 날짜(${diffType}) 차이가 허용 범위(${permitValue})를 넘어섰습니다. ${diffNum}`,
        // );
        return false;
      }
      // momentDate.format('YYYY-MM-DD HH:mm:ss'),
      return true;
    });
  }

  /**
   * DB에 데이터 삽입
   * @param {nodeInfo[]} nodeList 노드 리스트
   * @param {{hasSensor: boolean, hasDevice: boolean}} insertOption DB에 입력 처리 체크
   */
  async insertNodeDataToDB(nodeList, insertOption = { hasSensor: false, hasDevice: false }) {
    const { DEVICE, SENSOR } = nodeDataType;
    const { FOR_DB } = nodePickKey;
    const returnValue = [];
    try {
      if (insertOption.hasSensor) {
        const nodeSensorList = _(nodeList)
          .filter(ele => ele.save_db_type === SENSOR && _.isNumber(ele.data))
          .map(ele => BU.renameObj(_.pick(ele, FOR_DB), 'data', 'num_data'))
          .value();
        // BU.CLI(nodeSensorList);
        const result = await this.biModule.setTables('dv_sensor_data', nodeSensorList, false);
        returnValue.push(result);
      }

      // 장치류 삽입
      if (insertOption.hasDevice) {
        const nodeDeviceList = _(nodeList)
          .filter(ele => ele.save_db_type === DEVICE && _.isString(ele.data))
          .map(ele => BU.renameObj(_.pick(ele, FOR_DB), 'data', 'str_data'))
          .value();

        // BU.CLI(nodeDeviceList);
        const result = await this.biModule.setTables('dv_device_data', nodeDeviceList, false);
        returnValue.push(result);
      }
    } catch (error) {
      BU.errorLog('insertNodeDataToDB', error);
      return returnValue;
    }

    // BU.CLIN(nodeList);
    // BU.CLIS(insertOption, insertOption.hasSensor, insertOption.hasDevice);
    // 센서류 삽입
    return returnValue;
  }
}
module.exports = Model;
