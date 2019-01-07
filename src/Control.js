const _ = require('lodash');
const cron = require('cron');
const EventEmitter = require('events');
const uuidv4 = require('uuid/v4');
const moment = require('moment');
const Promise = require('bluebird');

const { BU } = require('base-util-jh');
const { BM } = require('base-model-jh');

const mainConfig = require('./config');

const { dcmConfigModel, dccFlagModel, dcmWsModel } = require('../../default-intelligence');

const { requestOrderCommandType, requestDeviceControlType, nodePickKey } = dcmConfigModel;
const { definedCommandSetRank } = dccFlagModel;

const DataLoggerController = require('../DataLoggerController');

const Model = require('./Model');

/** Main Socket Server와 통신을 수행하기 위한 Class */
const AbstApiClient = require('./features/ApiCommunicator/AbstApiClient');
/** 정해진 시나리오대로 진행하기 위한 Class */
const AbstScenario = require('./features/Scenario/AbstScenario');
/** 현황판 표현을 위한 Class, apiClient와의 통신을 통해 갱신 */
const AbstPBS = require('./features/PowerStatusBoard/AbstPBS');

class Control extends EventEmitter {
  /** @param {integratedDataLoggerConfig} config */
  constructor(config = mainConfig) {
    super();
    this.config = config;
    // BU.CLI(this.config);

    /** @type {placeInfo[]} */
    this.placeList = [];

    /** @type {DataLoggerController[]} */
    this.dataLoggerControllerList = [];
    /** @type {dataLoggerInfo[]} */
    this.dataLoggerList = [];
    /** @type {nodeInfo[]} */
    this.nodeList = [];

    /** @type {string} 데이터 지점 ID */
    this.mainUUID = this.config.uuid;

    // /** @type {DataLoggerController[]} */
    // this.preparingDataLoggerControllerList = [];

    // Data Logger 상태 계측을 위한 Cron Scheduler 객체
    this.cronScheduler = null;

    // 정기 장치 조회 수행 여부
    this.inquiryAllDeviceStatusTimer;

    /** @type {moment.Moment} */
    this.inquirySchedulerRunMoment;
  }

  /**
   * @desc Step 1
   * DB에서 특정 데이터를 가져오고 싶을경우
   * @param {dbInfo} dbInfo
   * @param {string} mainUUID main UUID
   * @return {Promise.<mainConfig>}
   */
  async getDataLoggerListByDB(dbInfo = this.config.dbInfo, mainUUID = this.mainUUID) {
    BU.CLI('getDataLoggerListByDB', dbInfo);
    this.mainUUID = mainUUID;
    this.config.dbInfo = dbInfo;
    const biModule = new BM(dbInfo);
    // BU.CLI(dbInfo);
    // BU.CLI(mainUUID);

    const mainWhere = _.isNil(mainUUID) ? null : { uuid: mainUUID };

    /** @type {dataLoggerConfig[]} */
    const dataLoggerControllerConfigList = [];

    // DB에서 UUID 가 동일한 main 정보를 가져옴
    const mainInfo = await biModule.getTableRow('main', mainWhere);

    // UUID가 동일한 정보가 없다면 종료
    if (_.isEmpty(mainInfo)) {
      throw new Error(`uuid: ${mainUUID}는 존재하지 않습니다.`);
    }

    // 만약 MainUUID를 지정하지 않을 경우 해당 Row의 uuid를 가져와 세팅함
    _.isNil(this.mainUUID) && _.set(this, 'mainUUID', _.get(mainInfo, 'uuid'));

    // 가져온 Main 정보에서 main_seq를 구함
    const where = {
      main_seq: _.get(mainInfo, 'main_seq', ''),
    };

    // main_seq가 동일한 데이터 로거와 노드 목록을 가져옴
    this.dataLoggerList = await biModule.getTable('v_dv_data_logger', where);
    this.nodeList = await biModule.getTable('v_dv_node', where);

    // 장소 단위로 묶을 장소 목록을 가져옴
    this.placeList = await biModule.getTable('v_dv_place', where);
    // 장소에 속해있는 센서를 알기위한 목록을 가져옴
    /** @type {V_DV_PLACE_RELATION[]} */
    const viewPlaceRelationRows = await biModule.getTable('v_dv_place_relation', where);
    // 장소 관계 목록을 순회하면서 장소목록에 속해있는 node를 삽입
    viewPlaceRelationRows.forEach(plaRelRow => {
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

    // 리스트 돌면서 데이터 로거에 속해있는 Node를 세팅함
    this.dataLoggerList.forEach(dataLoggerInfo => {
      const { data_logger_seq: seqDL, connect_info = {}, protocol_info = {} } = dataLoggerInfo;

      const foundNodeList = _.filter(this.nodeList, nodeInfo => nodeInfo.data_logger_seq === seqDL);

      // 환경 정보가 strJson이라면 변환하여 저장
      BU.IsJsonString(connect_info) &&
        _.set(dataLoggerInfo, 'connect_info', JSON.parse(connect_info));

      BU.IsJsonString(protocol_info) &&
        _.set(dataLoggerInfo, 'protocol_info', JSON.parse(protocol_info));

      /** @type {dataLoggerConfig} */
      const loggerConfig = {
        hasDev: false,
        dataLoggerInfo,
        nodeList: foundNodeList,
        deviceInfo: {},
      };

      dataLoggerControllerConfigList.push(loggerConfig);
    });

    _.set(this, 'config.dbInfo', dbInfo);
    _.set(this, 'config.dataLoggerList', dataLoggerControllerConfigList);

    // BU.CLIN(this.config.dataLoggerList, 2);
    // await Promise.delay(10);

    return this.config;

    // _.set(this.config, 'dataLoggerList', returnValue)
    // BU.CLI(returnValue);

    // BU.CLI(file);
    // BU.writeFile('out.json', file);
  }

  /**
   * 데이터 로거 객체를 생성하고 초기화를 진행
   * 1. setDeviceInfo --> controlInfo 정의 및 logOption 정의, deviceInfo 생성
   * 2. DCM, DPC, Model 정의
   * 3. Commander 를 Observer로 등록
   * 4. 생성 객체를 routerLists 에 삽입
   */
  async init() {
    try {
      // BU.CLI(this.mainUUID, this.dataLoggerList.length);
      // BU.CLIN(this.dataLoggerList);
      // 하부 Data Logger 순회
      const resultInitDataLoggerList = await Promise.map(
        this.config.dataLoggerList,
        dataLoggerConfig => {
          // BU.CLI(dataLoggerConfig);
          // 데이터 로거 객체 생성
          const dataLoggerController = new DataLoggerController(dataLoggerConfig);

          // DataLogger, NodeList 설정
          dataLoggerController.s1SetLoggerAndNodeByConfig();
          // deviceInfo 설정
          dataLoggerController.s2SetDeviceInfo();
          // DeviceClientController, ProtocolConverter, Model 초기화
          // 컨트롤러에 현 객체 Observer 등록
          dataLoggerController.attach(this);

          // BU.CLI(`DBS Init  ${this.mainUUID}`, dataLoggerConfig.dataLoggerInfo.dl_real_id);
          return dataLoggerController.init(this.mainUUID);
        },
      );

      // BU.CLI(`what the ?  ${this.mainUUID}`, resultInitDataLoggerList.length);

      // 하부 PCS 객체 리스트 정의
      this.dataLoggerControllerList = resultInitDataLoggerList;
      // BU.CLIN(this.dataLoggerControllerList);

      /** @type {Model} */
      this.model = _.has(this, 'Model') ? new this.Model(this) : new Model(this);
      // DBS 사용 Map 설정
      await this.model.setMap();

      this.bindingFeature();

      return this.dataLoggerControllerList;
    } catch (error) {
      throw error;
    }
  }

  /** DBS 순수 기능 외에 추가 될 기능 */
  bindingFeature() {
    BU.CLI('bindingFeature');
    // API Socket Server
    this.apiClient = new AbstApiClient(this);
    // 현황판
    this.powerStatusBoard = new AbstPBS(this);
    // 시나리오 관리자
    this.scenarioManager = new AbstScenario(this);
  }

  /**
   * Passive Client를 수동으로 붙여줄 경우
   * @param {string} mainUUID Site ID
   * @param {*} passiveClient
   * @return {boolean} 성공 유무
   */
  setPassiveClient(mainUUID, passiveClient) {
    if (this.mainUUID !== mainUUID) {
      throw new Error(
        `The ${
          this.mainUUID
        } of this site is different from the ${mainUUID} of the site you received.`,
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
   * @abstract
   * @param {nodeInfo} nodeInfo
   * @param {string} controlValue
   */
  convertControlValueToString(nodeInfo, controlValue) {
    controlValue = Number(controlValue);
    let strControlValue = '';
    const onOffList = ['pump'];
    const openCloseList = ['valve', 'waterDoor'];

    let strTrue = '';
    let strFalse = '';

    // Node Class ID를 가져옴. 장치 명에 따라 True, False 개체 명명 변경
    if (_.includes(onOffList, nodeInfo.nc_target_id)) {
      strTrue = 'On';
      strFalse = 'Off';
    } else if (_.includes(openCloseList, nodeInfo.nc_target_id)) {
      strTrue = 'Open';
      strFalse = 'Close';
    }

    switch (controlValue) {
      case requestDeviceControlType.FALSE:
        strControlValue = strFalse;
        break;
      case requestDeviceControlType.TRUE:
        strControlValue = strTrue;
        break;
      case requestDeviceControlType.MEASURE:
        strControlValue = 'Measure';
        break;
      case requestDeviceControlType.SET:
        strControlValue = 'Set';
        break;
      default:
        break;
    }
    return strControlValue;
  }

  /**
   * 외부에서 단일 명령을 내릴경우
   * @param {requestSingleOrderInfo} requestSingleOrderInfo
   */
  executeSingleControl(requestSingleOrderInfo) {
    // BU.CLI('executeSingleControl');
    process.env.LOG_DBS_EXEC_SC === '1' && BU.CLIN(requestSingleOrderInfo);

    const {
      requestCommandType,
      nodeId,
      controlValue,
      controlSetValue,
      rank = definedCommandSetRank.SECOND,
    } = requestSingleOrderInfo;
    const nodeInfo = _.find(this.nodeList, { node_id: nodeId });
    try {
      /** @type {requestCombinedOrderInfo} */
      const requestCombinedOrder = {
        requestCommandId: `S_${nodeId}_${this.convertControlValueToString(nodeInfo, controlValue)}`,
        requestCommandName: '',
        requestCommandType,
        requestElementList: [],
      };

      /** @type {requestOrderElementInfo} */
      const requestOrderElement = { nodeId, controlValue, controlSetValue, rank };

      requestCombinedOrder.requestElementList.push(requestOrderElement);

      return this.executeCombineOrder(requestCombinedOrder);
    } catch (error) {
      BU.errorLog('excuteControl', 'Error', error);
    }
  }

  /**
   * 자동 명령 요청
   * @param {{cmdName: string, trueList: string[], falseList: string[]}} controlInfo
   */
  executeAutomaticControl(controlInfo) {
    process.env.LOG_DBS_EXEC_AC === '1' && BU.CLI(controlInfo);

    const { cmdName, trueList = [], falseList = [] } = controlInfo;

    /** @type {requestCombinedOrderInfo} */
    const requestCombinedOrder = {
      requestCommandId: cmdName,
      requestCommandName: `${cmdName} ${requestOrderCommandType.CONTROL}`,
      requestCommandType: requestOrderCommandType.CONTROL,
      requestElementList: [],
    };

    // 장치 True 요청
    if (trueList.length) {
      requestCombinedOrder.requestElementList.push({
        controlValue: requestDeviceControlType.TRUE,
        nodeId: trueList,
        rank: definedCommandSetRank.SECOND,
      });
    }

    // 장치 False 요청
    if (falseList.length) {
      requestCombinedOrder.requestElementList.push({
        controlValue: requestDeviceControlType.FALSE,
        nodeId: falseList,
        rank: definedCommandSetRank.SECOND,
      });
    }

    return this.executeCombineOrder(requestCombinedOrder);
  }

  /**
   * 명령 취소 요청
   * @param {{cmdName: string, trueList: string[], falseList: string[]}} controlInfo
   */
  cancelAutomaticControl(controlInfo) {
    process.env.LOG_DBS_EXEC_AC === '1' && BU.CLI(controlInfo);

    const { cmdName, trueList = [], falseList = [] } = controlInfo;
    /** @type {requestCombinedOrderInfo} */
    const requestCombinedOrder = {
      requestCommandId: cmdName,
      requestCommandName: `${cmdName} ${requestOrderCommandType.CANCEL}`,
      requestCommandType: requestOrderCommandType.CANCEL,
      requestElementList: [],
    };

    // 장치 False 요청 (켜져 있는 장치만 끔)
    if (trueList.length) {
      requestCombinedOrder.requestElementList.push({
        controlValue: requestDeviceControlType.FALSE,
        nodeId: _.reverse(trueList),
        rank: definedCommandSetRank.SECOND,
      });
    }

    // FIXME: 명령 취소에 대한 논리 정립이 안되어 있어 다시 동작 시키는 명령은 비활성
    // 장치 True 요청
    // if (falseList.length) {
    //   requestCombinedOrder.requestElementList.push({
    //     controlValue: requestDeviceControlType.TRUE,
    //     nodeId: _.reverse(falseList),
    //     rank: 2,
    //   });
    // }

    return this.executeCombineOrder(requestCombinedOrder);
  }

  /**
   * 저장된 명령 요청 수행
   * @param {{savedCommandId: string, requestCommandType: string }} savedCommandInfo 저장된 명령 ID
   */
  executeSavedCommand(savedCommandInfo) {
    try {
      const { savedCommandId, requestCommandType } = savedCommandInfo;
      const foundIt = _.find(this.model.excuteControlList, { cmdName: savedCommandId });
      if (foundIt) {
        const { trueList = [], falseList = [] } = foundIt;
        // 명령 제어 요청 일 경우
        if (requestCommandType === requestOrderCommandType.CONTROL) {
          return this.executeAutomaticControl({
            cmdName: savedCommandId,
            trueList,
            falseList,
          });
        }
        if (requestCommandType === requestOrderCommandType.CANCEL) {
          // 명령 취소 일 경우
          return this.cancelAutomaticControl({
            cmdName: savedCommandId,
            trueList,
            falseList,
          });
        }
        throw new Error(`commandType: ${requestCommandType} can not be identified. `);
      }
      throw new Error(`commandId: ${savedCommandId} does not exist.`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 시나리오를 수행하고자 할 경우
   * @param {{scenarioId: string, requestCommandType: string}} scenarioInfo 시나리오 ID
   */
  executeScenario(scenarioInfo) {
    this.scenarioManager.executeScenario(scenarioInfo);
  }

  /**
   * 복합 명령 실행 요청
   * @param {requestCombinedOrderInfo} requestCombinedOrder
   * @return {boolean} 명령 요청 여부
   */
  executeCombineOrder(requestCombinedOrder) {
    process.env.LOG_DBS_EXEC_CO_HEADER === '1' && BU.CLI('execCombineOrder', requestCombinedOrder);

    // 복합 명령을 해체하여 정의
    const {
      requestCommandId,
      requestCommandType,
      requestCommandName,
      requestElementList,
    } = requestCombinedOrder;

    /** @type {combinedOrderWrapInfo} */
    const combinedWrapOrder = {
      uuid: uuidv4(),
      requestCommandId,
      requestCommandType,
      requestCommandName,
      orderContainerList: [],
    };

    // 요청 복합 명령 객체의 요청 리스트를 순회하면서 combinedOrderContainerInfo 객체를 만들고 삽입
    requestElementList.forEach(requestElementInfo => {
      const {
        nodeId,
        controlValue = requestDeviceControlType.MEASURE,
        controlSetValue,
        rank = definedCommandSetRank.THIRD,
      } = requestElementInfo;
      // nodeId가 string이라면 배열생성 후 집어넣음
      const nodeList = _.isArray(nodeId) ? nodeId : [nodeId];

      // 해당 controlValue가 orderElementList 기존재하는지 체크
      let foundRemainInfo = _.find(combinedWrapOrder.orderContainerList, {
        controlValue,
      });
      // 없다면
      if (!foundRemainInfo) {
        foundRemainInfo = {
          controlValue,
          controlSetValue,
          orderElementList: [],
        };
        combinedWrapOrder.orderContainerList.push(foundRemainInfo);
      }

      // 배열을 반복하면서 element를 생성 후 remainInfo에 삽입
      _.forEach(nodeList, currNodeId => {
        // BU.CLI(currNodeId);
        // 장치와 연결되어 있는 DLC 불러옴
        const dataLoggerController = this.model.findDataLoggerController(currNodeId);
        // 해당하는 DLC가 없거나 장치가 비접속이라면 명령을 수행하지 않음
        // TODO: requestCombinedOrder의 실행 가능 여부를 판단하고 명령에서 제외하는 것이 맞는지 검증 필요
        let errMsg = '';
        if (_.isUndefined(dataLoggerController)) {
          errMsg = `DLC: ${currNodeId}가 존재하지 않습니다.`;
          // BU.CLI(errMsg);
        } else if (!_.get(dataLoggerController, 'hasConnectedDevice')) {
          errMsg = `${currNodeId}는 장치와 연결되지 않았습니다.`;
          // BU.CLI(errMsg);
        }
        if (errMsg.length) {
          BU.errorLog(
            'executeCombineOrder',
            `mainUUID: ${
              this.mainUUID
            } nodeId: ${currNodeId} controlValue: ${controlValue} msg: ${errMsg}`,
          );
        } else {
          /** @type {combinedOrderElementInfo} */
          const elementInfo = {
            hasComplete: false,
            nodeId: currNodeId,
            rank,
            uuid: uuidv4(),
          };

          foundRemainInfo.orderElementList.push(elementInfo);
        }
      });
    });

    process.env.LOG_DBS_EXEC_CO_TAIL === '1' && BU.CLIN(combinedWrapOrder, 2);

    // 복합 명령 저장
    const hasSaved = this.model.saveCombinedOrder(
      requestCombinedOrder.requestCommandType,
      combinedWrapOrder,
    );

    // 복합 명령 실행 요청
    // FIXME: 장치와의 연결이 해제되었더라도 일단 명령 요청을 함. 연결이 해제되면 아에 명령 요청을 거부할지. 어떻게 해야할지 고민 필요
    this.executeCommandToDLC(combinedWrapOrder);

    return hasSaved;
  }

  /**
   * Data Logger Controller로 실제로 명령을 요청하는 메소드
   * @param {combinedOrderWrapInfo} combinedOrderWrapInfo
   * @memberof Control
   */
  executeCommandToDLC(combinedOrderWrapInfo) {
    // BU.CLI(combinedOrderWrapInfo)
    process.env.LOG_DBS_TRANS_ORDER === '1' && BU.CLI('transferRequestOr', combinedOrderWrapInfo);

    const {
      uuid: integratedUUID,
      requestCommandId,
      requestCommandName,
      requestCommandType,
    } = combinedOrderWrapInfo;

    // 아직 요청 전이므로 orderContainerList 순회하면서 명령 생성 및 요청
    combinedOrderWrapInfo.orderContainerList.forEach(combinedOrderContainerInfo => {
      const { controlValue, controlSetValue } = combinedOrderContainerInfo;

      // const hasFirst = true;
      combinedOrderContainerInfo.orderElementList.forEach(combinedOrderElementInfo => {
        const { nodeId, rank, uuid } = combinedOrderElementInfo;
        // if (hasFirst) {
        /** @type {executeOrderInfo} */
        const executeOrder = {
          integratedUUID,
          requestCommandId,
          requestCommandName,
          requestCommandType,
          controlValue,
          controlSetValue,
          nodeId,
          rank,
          uuid,
        };

        const dataLoggerController = this.model.findDataLoggerController(nodeId);

        dataLoggerController.orderOperation(executeOrder);
        // hasFirst = false;
        // }
      });
    });
  }

  /**
   * 데이터 로거의 현 상태를 조회하는 스케줄러
   */
  runDeviceInquiryScheduler() {
    // BU.CLI('runDeviceInquiryScheduler');
    try {
      if (this.cronScheduler !== null) {
        // BU.CLI('Stop')
        this.cronScheduler.stop();
      }
      // BU.CLI(this.config.inquiryIntervalSecond)
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

      return true;
    } catch (error) {
      throw error;
    }
  }

  /** 정기적인 Router Status 탐색
   * @param {moment.Moment} momentDate
   *
   */
  inquiryAllDeviceStatus() {
    BU.CLI('inquiryAllDeviceStatus')
    process.env.LOG_DBS_INQUIRY_START === '1' &&
      BU.CLI(`${this.makeCommentMainUUID()} Start inquiryAllDeviceStatus`);

    /** @type {requestCombinedOrderInfo} */
    const requestCombinedOrder = {
      requestCommandId: 'inquiryAllDeviceStatus',
      requestCommandName: '정기 장치 상태 계측',
      requestCommandType: requestOrderCommandType.MEASURE,
      requestElementList: [{ nodeId: _.map(this.dataLoggerList, 'dl_id') }],
    };

    BU.CLI(_.map(this.dataLoggerList, 'dl_id'));

    // 명령 요청
    const hasTransferInquiryStatus = this.executeCombineOrder(requestCombinedOrder);

    BU.CLI(hasTransferInquiryStatus);

    // 장치와의 접속이 이루어지지 않을 경우 명령 전송하지 않음
    if (!hasTransferInquiryStatus) {
      BU.CLI(`${this.makeCommentMainUUID()} Empty Order inquiryAllDeviceStatus`);
      return false;
    }

    // Data Logger 현재 상태 조회
    // this.dataLoggerControllerList.forEach(router => {
    //   /** @type {requestOrderInfo} */
    //   let ruquestOrder = {};
    //   ruquestOrder.nodeId = 'DEFAULT';
    //   ruquestOrder.requestCommandType = 'ADD';
    //   ruquestOrder.requestCommandId = 'regularDiscovery';

    //   router.orderOperationDefault(ruquestOrder);
    // });
  }

  /** 인증이 되었음을 알림 */
  // nofityAuthentication() {
  //   BU.CLI('nofityAuthentication');
  //   // 현황판 데이터 요청
  //   this.emit('nofityAuthentication');
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
      // 아직 접속이 이루어져있지 않을 경우 보내지 않음
      if (!this.apiClient.isConnect) {
        return false;
      }
      this.apiClient.transmitDataToServer({
        commandType: dcmWsModel.transmitToServerCommandType.NODE,
        data: this.model.getAllNodeStatus(nodePickKey.FOR_SERVER, renewalNodeList),
      });
    } catch (error) {
      BU.CLI(error);
    }
  }

  /**
   * TODO: 이벤트 처리
   * Device Client로부터 Error 수신
   * @param {DataLoggerController} dataLoggerController Data Logger Controller 객체
   * @param {dcEvent} dcEvent 이벤트 발생 내역
   */
  notifyDeviceEvent(dataLoggerController, dcEvent) {}

  /**
   * TODO: 메시지 처리
   * Device Client로부터 Message 수신
   * @param {DataLoggerController} dataLoggerController Data Logger Controller 객체
   * @param {dcMessage} dcMessage 명령 수행 결과 데이터
   */
  notifyDeviceMessage(dataLoggerController, dcMessage) {
    // const {COMMANDSET_EXECUTION_START, COMMANDSET_EXECUTION_TERMINATE, COMMANDSET_DELETE} = dataLoggerController.definedCommandSetMessage;
    // const commandSet = dcMessage.commandSet;

    this.model.manageCombinedStorage(dataLoggerController, dcMessage);
  }

  /**
   * TODO: Error 처리
   * Device Client로부터 Error 수신
   * @param {DataLoggerController} dataLoggerController Data Logger Controller 객체
   * @param {dcError} dcError 명령 수행 결과 데이터
   */
  notifyError(dataLoggerController, dcError) {}

  /** MainUUID 가 존재할 경우 해당 지점을 알리기 위한 텍스트 생성 */
  makeCommentMainUUID() {
    if (this.mainUUID.length) {
      return `MainUUID: ${this.mainUUID}`;
    }
    return '';
  }
}
module.exports = Control;
