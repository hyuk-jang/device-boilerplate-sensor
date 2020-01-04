const _ = require('lodash');
const moment = require('moment');

const { BU } = require('base-util-jh');
const { BM } = require('base-model-jh');

const {
  dcmConfigModel: { commandPickKey: cmdPickKey, nodeDataType, nodePickKey },
} = require('./module').di;

const CmdManager = require('./core/CommandManager/CommandManager');
const ScenarioManager = require('./core/CommandManager/ScenarioCommand/ScenarioManager');
const PlaceManager = require('./core/PlaceManager/PlaceManager');

class Model {
  /**
   * Creates an instance of Model.
   * @param {MainControl} controller
   * @memberof Model
   */
  constructor(controller) {
    this.controller = controller;

    const {
      config,
      coreFacade,
      deviceMap = {},
      dataLoggerControllerList,
      dataLoggerList,
      nodeList,
      placeList,
      placeRelationList,
    } = controller;

    this.coreFacade = coreFacade;
    this.dataLoggerControllerList = dataLoggerControllerList;
    this.dataLoggerList = dataLoggerList;
    this.nodeList = nodeList;
    this.placeList = placeList;
    this.placeRelationList = placeRelationList;

    this.biModule = new BM(config.dbInfo);

    // 정기 조회 Count
    this.inquirySchedulerIntervalSaveCnt = _.get(config, 'inquirySchedulerInfo.intervalSaveCnt', 1);
    this.inquirySchedulerCurrCount = 0;

    this.deviceMap = controller.deviceMap;

    // BU.CLIN(this.deviceMap, 1);

    // FIXME: 임시로 자동 명령 리스트 넣어둠. DB에서 가져오는 걸로 수정해야함(2018-07-30)
    this.excuteControlList = _.get(this.deviceMap, 'controlInfo.tempControlList', []);
  }

  /** Model 상세 초기화 */
  init() {
    // Map에 기록된 명령을 해석하여 상세한 명령으로 생성하여 MapInfo 에 정의
    this.initCommand();

    // 명령 관리자 초기화 진행
    /** @type {CmdManager} Control 에서 제어모드가 변경되면 현 객체 교체 정의 */
    this.cmdManager = new CmdManager(this);
    this.coreFacade.setCmdManager(this.cmdManager);
    this.cmdManager.init();

    this.scenarioManager = new ScenarioManager(this.mapCmdInfo.scenarioCmdList, this.coreFacade);
    this.coreFacade.setScenarioManager(this.scenarioManager);

    this.placeManager = new PlaceManager(this.coreFacade);
    this.coreFacade.setPlaceManager(this.placeManager);
    this.placeManager.init(this);
  }

  /**
   * Map에 기록된 명령을 해석하여 상세한 명령으로 생성하여 MapInfo 에 정의
   * 1. 단순 명령 출발지, 목적지 명 한글화
   * 2. 단순 명령 ID 코드 생성(srcPlaceId_TO_destPlaceId)
   */
  initCommand() {
    // BU.CLI(this.deviceMap)
    const {
      controlInfo: { flowCmdList = [], setCmdList = [], scenarioCmdList = [] } = {},
    } = this.deviceMap;

    // 단순 명령을 쉽게 인식하기 위한 한글 명령을 입력
    flowCmdList.forEach(simpleCommandInfo => {
      const { srcPlaceId } = simpleCommandInfo;

      // 출발지 한글 이름
      let { srcPlaceName } = simpleCommandInfo;

      if (_.isNil(srcPlaceName)) {
        srcPlaceName = _.chain(this.placeList)
          .find({ place_id: srcPlaceId })
          .get('place_name')
          .value();
      }
      // 출발지 한글이름 추가
      // simpleCommandInfo.srcPlaceName ||
      _.set(simpleCommandInfo, 'srcPlaceName', srcPlaceName);
      // 목적지 목록을 순회하면서 상세 명령 정보 정의
      simpleCommandInfo.destList.forEach(scDesInfo => {
        const { destPlaceId } = scDesInfo;
        let { destPlaceName } = scDesInfo;
        // 목적지 한글 이름
        if (_.isNil(destPlaceName)) {
          destPlaceName = _.chain(this.placeList)
            .find({ place_id: destPlaceId })
            .get('place_name')
            .value();
        }

        // 목적지 한글이름 추가 및 명령 정보 정의
        // _.set(simpleCommandInfo, 'destPlaceName', srcPlaceName);
        _.set(scDesInfo, 'cmdId', `${srcPlaceId}_TO_${destPlaceId}`);
        _.set(scDesInfo, 'cmdName', `${srcPlaceName} → ${destPlaceName}`);
      });
    });

    const mapCmdInfo = {
      /** @type {flowCmdInfo[]} 기존 Map에 있는 Flow Command를 변형 처리 */
      flowCmdList,
      setCmdList,
      scenarioCmdList,
    };

    this.mapCmdInfo = mapCmdInfo;
  }

  /**
   * 설정 명령을 찾고자 할 경우
   * @param {string} cmdId
   */
  findSetCommand(cmdId) {
    return _.find(this.mapCmdInfo.setCmdList, { cmdId });
  }

  /**
   * 시나리오 명령을 찾고자 할 경우
   * @param {string} scenarioId
   */
  findScenarioCommand(scenarioId) {
    return _.find(this.mapCmdInfo.scenarioCmdList, { scenarioId });
  }

  /**
   * 흐름 명령을 찾고자 할 경우
   * @param {Object} reqFlowCmd
   * @param {string=} reqFlowCmd.srcPlaceId 출발지 ID
   * @param {string=} reqFlowCmd.destPlaceId 목적지 Id
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
    try {
      // 출발지와 목적지가 있을 경우
      return _.chain(this.mapCmdInfo.flowCmdList)
        .find({ srcPlaceId })
        .get('destList')
        .find({ destPlaceId })
        .value();
    } catch (error) {
      return undefined;
    }
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
          BU.CLIN(this.controller.mainUUID);
          throw new Error(`Node ID: ${searchValue} is not exist`);
        }
        searchValue = nodeInfo.getDataLogger();
      }
    }

    return _.find(this.dataLoggerControllerList, router =>
      _.isEqual(router.dataLoggerInfo, searchValue),
    );
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

    // 정기 계측 명령 완료 이벤트 발송 (각 프로젝트 마다 Block Update 이벤트 바인딩 수신을 위함)
    this.controller.emit('completeInquiryAllDeviceStatus');

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
   * @param {nodePickKey} nodePickKeyInfo
   * @param {nodeInfo[]=} nodeList
   * @param {number[]=} targetSensorRange 보내고자 하는 센서 범위를 결정하고 필요 데이터만을 정리하여 반환
   */
  getAllNodeStatus(nodePickKeyInfo = nodePickKey.FOR_SERVER, nodeList = this.nodeList) {
    // Object 형태로 들어올 경우

    // 데이터 Key를 변환하여 보내주고자 할 경우
    if (!_.isArray(nodePickKeyInfo) && _.isObject(nodePickKeyInfo)) {
      return _.map(nodeList, nodeInfo => {
        // BU.CLI(nodeInfo)
        return _.reduce(
          nodePickKeyInfo,
          (result, value, key) => {
            result[value] = _.get(nodeInfo, key, '');
            return result;
          },
          {},
        );
      });
    }

    const orderKey = _.includes(nodePickKeyInfo, 'node_id') ? 'node_id' : _.head(nodePickKeyInfo);

    const statusList = _(nodeList)
      .map(nodeInfo => {
        if (nodePickKeyInfo) {
          return _.pick(nodeInfo, nodePickKeyInfo);
        }
        return nodeInfo;
      })
      .orderBy(orderKey)
      .value();
    // BU.CLI(statusList);
    return statusList;
  }

  /**
   * 모든 노드가 가지고 있는 정보 출력
   * @param {commandPickKey} cmdPickInfo
   * @param {CmdStorage[]=} cmdStorages
   * @param {number[]=} targetSensorRange 보내고자 하는 센서 범위를 결정하고 필요 데이터만을 정리하여 반환
   */
  getAllCmdStatus(cmdPickInfo = cmdPickKey.FOR_SERVER, cmdStorages = this.cmdManager.commandList) {
    return _(cmdStorages)
      .map(commandStorage => _.pick(commandStorage, cmdPickInfo))
      .value();
  }

  /**
   * 노드 리스트 중 입력된 날짜를 기준으로 유효성을 가진 데이터만 반환
   * @param {nodeInfo[]} nodeList
   * @param {timeIntervalToValidateInfo} diffInfo
   * @param {moment.Moment} momentDate
   * @return {nodeInfo[]}
   */
  checkValidateNodeData(
    nodeList = [],
    diffInfo = { diffType: 'minutes', duration: 1 },
    momentDate = moment(),
  ) {
    // BU.CLIN(nodeList);
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
