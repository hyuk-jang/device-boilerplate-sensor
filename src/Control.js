const _ = require('lodash');
const cron = require('cron');
const EventEmitter = require('events');
const moment = require('moment');
const Promise = require('bluebird');

const { BU } = require('base-util-jh');
const { BM } = require('base-model-jh');

const {
  dcmConfigModel: { nodePickKey },
  dcmWsModel: { transmitToServerCommandType: transmitToServerCT },
} = require('./module').di;

const mainConfig = require('./config');

const CoreFacade = require('./core/CoreFacade');

const DataLoggerController = require('../DataLoggerController');

const Model = require('./Model');
const CommandExecManager = require('./CommandExecManager');

const NodeUpdatorManager = require('./core/Updator/NodeUpdator/NodeUpdatorManager');
const AlgorithmStorage = require('./core/AlgorithmManager/AlgorithmStorage');
const AlgorithmMode = require('./core/AlgorithmManager/AlgorithmMode');

/** Main Socket Server와 통신을 수행하기 위한 Class */
const AbstApiClient = require('./features/ApiCommunicator/AbstApiClient');
/** 현황판 표현을 위한 Class, apiClient와의 통신을 통해 갱신 */
const AbstPBS = require('./features/PowerStatusBoard/AbstPBS');
/** 현황판 표현을 위한 Class, apiClient와의 통신을 통해 갱신 */
const AbstBlockManager = require('./features/BlockManager/AbstBlockManager');

class Control extends EventEmitter {
  /** @param {integratedDataLoggerConfig} config */
  constructor(config = mainConfig) {
    super();
    this.config = config;
    // BU.CLI(this.config);
    // Core Facade 등록
    this.coreFacade = new CoreFacade(this);

    /** @type {placeInfo[]} */
    this.placeList = [];

    /** @type {V_DV_PLACE_RELATION[]} */
    this.placeRelationList = [];

    /** @type {DataLoggerController[]} */
    this.dataLoggerControllerList = [];
    /** @type {dataLoggerInfo[]} */
    this.dataLoggerList = [];
    /** @type {nodeInfo[]} */
    this.nodeList = [];

    /** @type {string} 데이터 지점 ID */
    this.mainUUID = this.config.uuid;

    this.Model = Model;

    // Data Logger 상태 계측을 위한 Cron Scheduler 객체
    this.cronScheduler = null;

    // 정기 장치 조회 수행 여부
    this.inquiryAllDeviceStatusTimer;

    /** @type {moment.Moment} */
    this.inquirySchedulerRunMoment;
  }

  /**
   * DBS 를 구동하기 위한 초기화 및 프로그램 시작점
   * @param {dbInfo} dbInfo
   * @param {string} mainUUID
   */
  async init(dbInfo, mainUUID) {
    try {
      // init Step: 1 DB 정보를 기초로 nodeList, dataLoggerList, placeList 구성
      await this.initSetProperty(dbInfo, mainUUID);

      // init Step: 2 Updator 등록(Step 1에서 nodeList를 정의한 후 진행해야 함)
      this.nodeUpdatorManager = new NodeUpdatorManager(this.nodeList);

      // init Step: 3 this.dataLoggerList 목록을 돌면서 DLC 객체를 생성하기 위한 설정 정보 생성
      this.initMakeConfigForDLC();

      // init Step: 4 DLC 객체를 Constuction And Operation
      // DLC ConOps는 Async이나 성공 유무를 기다리지 않고 Feature를 Binding 함
      await this.initCreateOpsDLC();

      // Binding Feature
      this.bindingFeature();
    } catch (error) {
      BU.errorLog('init', error);
    }
  }

  /**
   * @desc init Step: 1
   * DB 정보를 기초로 nodeList, dataLoggerList, placeList 구성
   * @param {dbInfo} dbInfo
   * @param {string} mainUUID
   */
  async initSetProperty(dbInfo = this.config.dbInfo, mainUUID = this.mainUUID) {
    this.mainUUID = mainUUID;
    this.config.dbInfo = dbInfo;
    const biModule = new BM(dbInfo);

    const mainWhere = _.isNil(mainUUID) ? null : { uuid: mainUUID };

    /** @type {MAIN} DB에서 UUID 가 동일한 main 정보를 가져옴 */
    const mainRow = await biModule.getTableRow('main', mainWhere);

    // UUID가 동일한 정보가 없다면 종료
    if (_.isEmpty(mainRow)) {
      throw new Error(`uuid: ${mainUUID}는 존재하지 않습니다.`);
    }

    // 만약 MainUUID를 지정하지 않을 경우 해당 Row의 uuid를 가져와 세팅함
    _.isNil(this.mainUUID) && _.set(this, 'mainUUID', _.get(mainRow, 'uuid'));

    // 가져온 Main 정보에서 main_seq를 구함
    this.mainSeq = _.get(mainRow, 'main_seq', '');
    this.mainRow = mainRow;

    const where = {
      main_seq: this.mainSeq,
    };

    mainRow.map === null && _.set(mainRow, 'map', {});
    /** @type {mDeviceMap} */
    this.deviceMap = BU.IsJsonString(mainRow.map) ? JSON.parse(mainRow.map) : {};

    // main_seq가 동일한 데이터 로거와 노드 목록을 가져옴
    this.dataLoggerList = await biModule.getTable('v_dv_data_logger', { is_deleted: 0, ...where });

    this.nodeList = await biModule.getTable('v_dv_node', where);

    // 장소 단위로 묶을 장소 목록을 가져옴
    this.placeList = await biModule.getTable('v_dv_place', where);

    // DB에 들어가있는 세부 장소 정보는 long text 형태이므로 데이터가 변환할 수 있을 경우 JSON 객체로 변환 후 재 지정
    this.placeList.forEach(placeInfo => {
      const customPlaceInfo = placeInfo.place_info;
      if (_.isString(customPlaceInfo) && BU.IsJsonString(customPlaceInfo)) {
        placeInfo.place_info = JSON.parse(customPlaceInfo);
      }
    });

    // 장소에 속해있는 센서를 알기위한 목록을 가져옴
    this.placeRelationList = await biModule.getTable('v_dv_place_relation', where);

    // 장소 관계 목록을 순회하면서 장소목록에 속해있는 node를 삽입
    this.placeRelationList.forEach(plaRelRow => {
      // 장소 시퀀스와 노드 시퀀스를 불러옴
      const { place_seq: placeSeq, node_seq: nodeSeq } = plaRelRow;
      // 장소 시퀀스를 가진 객체 검색
      const placeInfo = _.find(this.placeList, { place_seq: placeSeq });
      // 노드 시퀀스를 가진 객체 검색
      const nodeInfo = _.find(this.nodeList, { node_seq: nodeSeq });

      // 장소에 해당 노드가 있다면 자식으로 설정. nodeList 키가 없을 경우 생성
      if (_.isObject(placeInfo) && _.isObject(nodeInfo)) {
        !_.has(placeInfo, 'nodeList') && _.set(placeInfo, 'nodeList', []);
        placeInfo.nodeList.push(nodeInfo);
      }
    });

    // 맵 데이터 중 DBS에서 필요치 않는 Draw 관련 정보 삭제
    _.unset(this.deviceMap, 'drawInfo');
    _.unset(this.mainRow, 'map');
  }

  /**
   * @desc init Step: 2
   * this.dataLoggerList 목록을 돌면서 DLC 객체를 생성하기 위한 설정 정보 생성
   */
  initMakeConfigForDLC() {
    // 리스트 돌면서 데이터 로거에 속해있는 Node를 세팅함
    this.config.dataLoggerList = this.dataLoggerList.map(dataLoggerInfo => {
      const {
        data_logger_seq: seqDL,
        connect_info: connectInfo = {},
        protocol_info: protocolInfo = {},
      } = dataLoggerInfo;

      const foundNodeList = _.filter(this.nodeList, nodeInfo => nodeInfo.data_logger_seq === seqDL);

      /** @type {connect_info} */
      const connInfo = JSON.parse(connectInfo);
      /** @type {protocol_info} */
      const protoInfo = JSON.parse(protocolInfo);

      // 장치 id가 Buffer 타입이라면 Buffer로 변환 후 strnig 으로 변환
      if (protoInfo.deviceId && protoInfo.deviceId.type === 'Buffer') {
        protoInfo.deviceId = Buffer.from(protoInfo.deviceId.data).toString();
      }
      // Connect 옵션이 Parser이고 option이 Buffer String 일 경우 Buffer로 변환하여 저장
      const { subType, addConfigInfo } = connInfo;
      if (subType === 'parser' && _.get(addConfigInfo, 'option.type') === 'Buffer') {
        connInfo.addConfigInfo.option = Buffer.from(addConfigInfo.option.data);
      }

      // 변환한 설정정보 입력
      _.set(dataLoggerInfo, 'connect_info', connInfo);
      _.set(dataLoggerInfo, 'protocol_info', protoInfo);

      /** @type {dataLoggerConfig} */
      const loggerConfig = {
        hasDev: false,
        dataLoggerInfo,
        nodeList: foundNodeList,
        deviceInfo: {},
      };

      return loggerConfig;
    });
  }

  /**
   * @desc init Step: 3
   * DLC 객체를 Constuction And Operation
   * 데이터 로거 객체를 생성하고 초기화를 진행
   * 1. setDeviceInfo --> controlInfo 정의 및 logOption 정의, deviceInfo 생성
   * 2. DCM, DPC, Model 정의
   * 3. Commander 를 Observer로 등록
   * 4. 생성 객체를 routerLists 에 삽입
   */
  async initCreateOpsDLC() {
    // 하부 Data Logger 순회
    const resultInitDataLoggerList = await Promise.map(
      this.config.dataLoggerList,
      dataLoggerConfig => {
        // 데이터 로거 객체 생성
        const dataLoggerController = new DataLoggerController(dataLoggerConfig);

        // DataLogger, NodeList 설정
        dataLoggerController.s1SetLoggerAndNodeByConfig();
        // deviceInfo 설정
        dataLoggerController.s2SetDeviceInfo();
        // DeviceClientController, ProtocolConverter, Model 초기화
        // 컨트롤러에 현 객체 Observer 등록
        dataLoggerController.attach(this);

        return dataLoggerController.init(this.mainUUID);
      },
    );

    // 하부 PCS 객체 리스트 정의
    this.dataLoggerControllerList = resultInitDataLoggerList;

    /** @type {Model} */
    this.model = new this.Model(this);
    this.model.init();

    // 모델 등록
    this.coreFacade.setModel(this.model);

    this.commandExecManager = new CommandExecManager(this);

    return this.dataLoggerControllerList;
  }

  /**
   * @desc init Step: 4
   * DBS 순수 기능 외에 추가 될 기능
   */
  bindingFeature() {
    // API Socket Server
    this.apiClient = new AbstApiClient(this);
    // 현황판
    this.powerStatusBoard = new AbstPBS(this);
    // 블록 매니저
    this.blockManager = new AbstBlockManager(this);

    const algorithmStorage = new AlgorithmStorage(this.coreFacade);
    // 기본 운용모드 등록(임계치 발생 시 아무런 행동하지 않음)
    const algorithmMode = new AlgorithmMode(this.coreFacade);
    algorithmStorage.addOperationMode(algorithmMode);
    // 초기 구동 모드 Default 변경
    algorithmStorage.changeOperationMode();
    // coreFacade에 알고리즘 저장소 등록
    this.coreFacade.setCoreAlgorithm(algorithmStorage);
  }

  /**
   * @desc init Step: 5
   * 생성된 Feature를 구동시킴
   * @param {dbsFeatureConfig} featureConfig
   * @return {Promise}
   */
  runFeature(featureConfig) {}

  /**
   * Passive Client를 수동으로 붙여줄 경우
   * @param {string} mainUUID Site ID
   * @param {*} passiveClient 접속해온 Client
   * @return {boolean} 성공 유무
   */
  setPassiveClient(mainUUID, passiveClient) {
    if (this.mainUUID !== mainUUID) {
      throw new Error(
        `The ${this.mainUUID} of this site is different from the ${mainUUID} of the site you received.`,
      );
    }
    const fountIt = _.find(this.dataLoggerControllerList, dataLoggerController =>
      _.isEqual(dataLoggerController.siteUUID, mainUUID),
    );

    // 해당 지점이 없다면 실패
    if (_.isEmpty(fountIt)) return false;
    // client를 binding 처리
    fountIt.bindingPassiveClient(mainUUID, passiveClient);
    return true;
  }

  /**
   * 제어 모드를 변경할 경우(Api Server에서 요청)
   * Core Algorithm 변경
   * @param {string} algorithmId Algorithm Id
   */
  changeOperationMode(algorithmId) {
    return this.coreFacade.changeOperationMode(algorithmId);
  }

  /**
   * @desc 수동 모드에서만 사용 가능
   * 외부에서 단일 명령을 내릴경우
   * @param {reqSingleCmdInfo} reqSingleCmdInfo
   */
  executeSingleControl(reqSingleCmdInfo) {
    // BU.CLI(reqSingleCmdInfo);
    return this.commandExecManager.executeSingleControl(reqSingleCmdInfo);
  }

  /**
   * 설정 명령 요청 수행
   * @param {reqSetCmdInfo} reqSetCmdInfo 저장된 명령 ID
   */
  executeSetControl(reqSetCmdInfo) {
    return this.commandExecManager.executeSetControl(reqSetCmdInfo);
  }

  /**
   * @desc 수동 모드에서만 사용 가능
   * 외부에서 단일 명령을 내릴경우
   * @param {reqFlowCmdInfo} reqFlowCmdInfo
   */
  executeFlowControl(reqFlowCmdInfo) {
    return this.commandExecManager.executeFlowControl(reqFlowCmdInfo);
  }

  /**
   * 시나리오를 수행하고자 할 경우
   * @param {reqScenarioCmdInfo} reqScenarioCmdInfo 시나리오 명령 정보
   */
  executeScenarioControl(reqScenarioCmdInfo) {
    return this.commandExecManager.executeScenarioControl(reqScenarioCmdInfo);
  }

  /**
   * 기존에 실행 중인 명령을 취소하고자 할 경우
   * @param {executeCmdInfo} executeCmdInfo
   */
  executeCancelCommand(executeCmdInfo) {
    return this.commandExecManager.executeCancelCommand(executeCmdInfo);
  }

  /**
   * 정기적인 Router Status 탐색
   */
  inquiryAllDeviceStatus() {
    return this.commandExecManager.inquiryAllDeviceStatus();
  }

  /**
   * 데이터 로거의 현 상태를 조회하는 스케줄러
   */
  runDeviceInquiryScheduler() {
    if (this.cronScheduler !== null) {
      this.cronScheduler.stop();
    }
    // 1분마다 요청
    this.cronScheduler = new cron.CronJob(
      this.config.inquirySchedulerInfo.intervalCronFormat,
      () => {
        this.inquirySchedulerRunMoment = moment();
        this.inquiryAllDeviceStatus();
      },
      null,
      true,
    );
  }

  /** 인증이 되었음을 알림 */
  // nofityAuthentication() {
  //   BU.CLI('nofityAuthentication');
  // }

  /**
   * TODO: 데이터 처리
   * Data Logger Controller 로 부터 데이터 갱신이 이루어 졌을때 자동 업데이트 됨.
   * @param {DataLoggerController} dataLoggerController Data Logger Controller 객체
   * @param {nodeInfo[]} renewalNodeList 갱신된 노드 목록 (this.nodeList가 공유하므로 업데이트 필요 X)
   */
  notifyDeviceData(dataLoggerController, renewalNodeList) {
    // NOTE: 갱신된 리스트를 Socket Server로 전송. 명령 전송 결과를 추적 하지 않음
    // 서버로 데이터 전송 요청
    try {
      // 노드 갱신 매니저에게 갱신된 노드 목록을 알림
      this.nodeUpdatorManager.updateNodeList(renewalNodeList);

      const dataList = this.model.getAllNodeStatus(
        nodePickKey.FOR_SERVER,
        renewalNodeList.filter(nodeInfo => nodeInfo.is_submit_api),
      );

      // API 접속이 이루어져 있고 데이터가 있을 경우에만 전송
      if (this.apiClient.isConnect && dataList.length) {
        this.apiClient.transmitDataToServer({
          commandType: transmitToServerCT.NODE,
          data: dataList,
        });
      }
    } catch (error) {
      // 예외는 기록만 함
      BU.error(error.message);
      throw error;
    }
  }

  /**
   * TODO: 이벤트 처리
   * Device Client로부터 Error 수신
   * @param {DataLoggerController} dataLoggerController Data Logger Controller 객체
   * @param {dcEvent} dcEvent 이벤트 발생 내역
   */
  notifyDeviceEvent(dataLoggerController, dcEvent) {
    const { CONNECT, DISCONNECT } = dataLoggerController.definedControlEvent;

    switch (dcEvent.eventName) {
      case CONNECT:
        break;
      // FIXME: 명령 삭제, DBW로 명령 Fail 전송(commandType: transmitToServerCT.COMMAND_FAIL)
      case DISCONNECT:
        break;
      default:
        break;
    }
  }

  /**
   * TODO: 메시지 처리
   * Device Client로부터 Message 수신
   * @param {DataLoggerController} dataLoggerController Data Logger Controller 객체
   * @param {dcMessage} dcMessage 명령 수행 결과 데이터
   */
  notifyDeviceMessage(dataLoggerController, dcMessage) {
    this.model.cmdManager.updateCommandMessage(dataLoggerController, dcMessage);
  }

  /**
   * TODO: Error 처리
   * Device Client로부터 Error 수신
   * @param {DataLoggerController} dataLoggerController Data Logger Controller 객체
   * @param {dcError} dcError 명령 수행 결과 데이터
   */
  notifyDeviceError(dataLoggerController, dcError) {}
}
module.exports = Control;
