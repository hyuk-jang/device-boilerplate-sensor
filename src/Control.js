const EventEmitter = require('events');
const uuidv4 = require('uuid/v4');
const cron = require('cron');
const _ = require('lodash');
const eventToPromise = require('event-to-promise');

const {BU} = require('base-util-jh');
const {BM} = require('../../base-model-jh');

// const Model = require('./Model');

const {
  requestOrderCommandType,
  requestDeviceControlType,
} = require('../../default-intelligence').dcmConfigModel;

const DataLoggerController = require('../DataLoggerController');

const Scenario = require('./Scenario');
const CommunicationMainControl = require('./CommunicationMainControl');

const Model = require('./Model');

class Control extends EventEmitter {
  /** @param {integratedDataLoggerConfig} config */
  constructor(config) {
    super();
    this.config = config;

    /** @type {DataLoggerController[]} */
    this.dataLoggerControllerList = [];
    /** @type {dataLoggerInfo[]} */
    this.dataLoggerList = [];
    /** @type {nodeInfo[]} */
    this.nodeList = [];

    /** @type {DataLoggerController[]} */
    this.preparingDataLoggerControllerList = [];

    // Data Logger 상태 계측을 위한 Cron Scheduler 객체
    this.cronScheduler = null;

    // 시나리오 관련
    this.scenario = new Scenario(this);
  }

  /**
   * @desc Step 1
   * DB에서 특정 데이터를 가져오고 싶을경우
   * @param {dbInfo} dbInfo
   * @param {string} mainUuid main UUID
   */
  async getDataLoggerListByDB(dbInfo, mainUuid) {
    const bM = new BM(dbInfo);

    /** @type {dataLoggerConfig[]} */
    const returnValue = [];

    // DB에서 UUID 가 동일한 main 정보를 가져옴
    const mainList = await bM.getTable('main', {uuid: mainUuid});

    // UUID가 동일한 정보가 없다면 종료
    if (mainList.length === 0) {
      throw new Error(`uuid: ${this.config.uuid}는 존재하지 않습니다.`);
    }

    // 가져온 Main 정보에서 main_seq를 구함
    const where = {
      main_seq: _.get(_.head(mainList), 'main_seq', ''),
    };

    // main_seq가 동일한 데이터 로거와 노드 목록을 가져옴
    this.dataLoggerList = await bM.getTable('v_data_logger', where);
    this.nodeList = await bM.getTable('v_node_profile', where);

    // 리스트 돌면서 데이터 로거에 속해있는 Node를 세팅함
    this.dataLoggerList.forEach(dataLoggerInfo => {
      /** @type {dataLoggerConfig} */
      const loggerConfig = {};

      const foundNodeList = _.filter(
        this.nodeList,
        nodeInfo => nodeInfo.data_logger_seq === dataLoggerInfo.data_logger_seq,
      );
      dataLoggerInfo.protocol_info = JSON.parse(_.get(dataLoggerInfo, 'protocol_info'));
      dataLoggerInfo.connect_info = JSON.parse(_.get(dataLoggerInfo, 'connect_info'));

      loggerConfig.dataLoggerInfo = dataLoggerInfo;
      loggerConfig.nodeList = foundNodeList;
      loggerConfig.hasDev = false;
      loggerConfig.deviceInfo = {};

      returnValue.push(loggerConfig);
    });

    _.set(this, 'config.dataLoggerList', returnValue);

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
  init() {
    this.model = new Model(this);
    this.communicationMainControl = new CommunicationMainControl(this);

    BU.CLI(this.config);
    this.config.dataLoggerList.forEach(dataLoggerConfig => {
      // 데이터 로거 객체 생성
      const dataLoggerController = new DataLoggerController(dataLoggerConfig);

      // DataLogger, NodeList 설정
      dataLoggerController.s1SetLoggerAndNodeByConfig();

      // deviceInfo 설정
      dataLoggerController.s2SetDeviceInfo();
      // DeviceClientController, ProtocolConverter, Model 초기화
      dataLoggerController.attach(this);

      // 하부 DataLogger Controller을 router라고 부르고 리스트에 삽입
      this.dataLoggerControllerList.push(dataLoggerController);
    });
    this.preparingDataLoggerControllerList = this.dataLoggerControllerList;
    this.preparingDataLoggerControllerList.forEach(dataLoggerController => {
      // 장치 연결, 프로토콜 컨버터 바인딩
      dataLoggerController.init();
    });
  }

  /**
   * 준비 완료 체크
   * @param {DataLoggerController} dataLoggerController
   * @param {dcEvent} dcEvent
   * @return {DataLoggerController[]}
   */
  checkReadyDataControllerList(dataLoggerController, dcEvent) {
    if (dcEvent.eventName === dataLoggerController.definedControlEvent.CONNECT) {
      _.remove(this.preparingDataLoggerControllerList, preDataLogger =>
        _.isEqual(preDataLogger, dataLoggerController),
      );
    }

    return this.preparingDataLoggerControllerList;
  }

  /**
   * 외부에서 단일 명령을 내릴경우
   * @param {requestSingleOrderInfo} requestSingleOrderInfo
   */
  excuteSingleControl(requestSingleOrderInfo) {
    try {
      /** @type {requestCombinedOrderInfo} */
      const requestCombinedOrder = {
        requestCommandId: '',
        requestCommandName: '',
        requestCommandType: requestSingleOrderInfo.requestCommandType,
        requestElementList: [],
      };

      /** @type {requestOrderElementInfo} */
      const requestOrderElement = {
        controlValue: requestSingleOrderInfo.controlValue,
        controlSetValue: requestSingleOrderInfo.controlSetValue,
        nodeId: requestSingleOrderInfo.nodeId,
        rank: _.get(requestSingleOrderInfo, 'rank'),
      };

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
    BU.CLI(controlInfo);

    /** @type {requestCombinedOrderInfo} */
    const requestCombinedOrder = {
      requestCommandId: controlInfo.cmdName,
      requestCommandName: controlInfo.cmdName,
      requestCommandType: requestOrderCommandType.CONTROL,
      requestElementList: [],
    };

    // 장치 True 요청
    const trueList = _.get(controlInfo, 'trueList', []);
    if (trueList.length) {
      requestCombinedOrder.requestElementList.push({
        controlValue: requestDeviceControlType.TRUE,
        nodeId: controlInfo.trueList,
        rank: 2,
      });
    }

    // 장치 False 요청
    const falseList = _.get(controlInfo, 'falseList', []);
    if (falseList.length) {
      requestCombinedOrder.requestElementList.push({
        controlValue: requestDeviceControlType.FALSE,
        nodeId: controlInfo.falseList,
        rank: 2,
      });
    }

    return this.executeCombineOrder(requestCombinedOrder);
  }

  /**
   * 명령 취소 요청
   * @param {{cmdName: string, trueList: string[], falseList: string[]}} controlInfo
   */
  cancelAutomaticControl(controlInfo) {
    /** @type {requestCombinedOrderInfo} */
    const requestCombinedOrder = {
      requestCommandId: controlInfo.cmdName,
      requestCommandName: controlInfo.cmdName,
      requestCommandType: requestOrderCommandType.CANCEL,
      requestElementList: [],
    };

    // 장치 False 요청 (켜져 있는 장치만 끔)
    const trueList = _.get(controlInfo, 'trueList', []);
    if (trueList.length) {
      requestCombinedOrder.requestElementList.push({
        controlValue: requestDeviceControlType.FALSE,
        nodeId: _.reverse(trueList),
        rank: 2,
      });
    }

    // FIXME: 명령 취소에 대한 논리 정립이 안되어 있어 다시 동작 시키는 명령은 비활성
    // 장치 True 요청
    // const falseList = _.get(controlInfo, 'falseList', []);
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
   * 복합 명령 실행 요청
   * @param {requestCombinedOrderInfo} requestCombinedOrder
   * @memberof Control
   */
  executeCombineOrder(requestCombinedOrder) {
    BU.CLI('excuteCombineOrder', requestCombinedOrder);
    // TODO: requestCombinedOrder의 실행 가능 여부 체크 메소드 구현

    /** @type {combinedOrderWrapInfo} */
    const combinedWrapOrder = {
      uuid: uuidv4(),
      requestCommandId: requestCombinedOrder.requestCommandId,
      requestCommandType: requestCombinedOrder.requestCommandType,
      requestCommandName: requestCombinedOrder.requestCommandName,
      orderContainerList: [],
    };

    // 요청 복합 명령 객체의 요청 리스트를 순회하면서 combinedOrderContainerInfo 객체를 만들고 삽입
    requestCombinedOrder.requestElementList.forEach(requestElementInfo => {
      // controlValue가 없다면 기본 값 2(Stauts)를 입력
      const controlValue =
        requestElementInfo.controlValue === undefined
          ? requestDeviceControlType.MEASURE
          : requestElementInfo.controlValue;
      // 해당 controlValue가 orderElementList 기존재하는지 체크
      let foundRemainInfo = _.find(combinedWrapOrder.orderContainerList, {
        controlValue,
      });
      // 없다면
      if (!foundRemainInfo) {
        /** @type {combinedOrderContainerInfo} */
        const container = {
          controlValue,
          controlSetValue: requestElementInfo.controlSetValue,
          orderElementList: [],
        };
        foundRemainInfo = container;
        combinedWrapOrder.orderContainerList.push(container);
      }
      // nodeId가 string이라면 배열생성 후 집어넣음
      requestElementInfo.nodeId = Array.isArray(requestElementInfo.nodeId)
        ? requestElementInfo.nodeId
        : [requestElementInfo.nodeId];
      // 배열을 반복하면서 element를 생성 후 remainInfo에 삽입
      _.forEach(requestElementInfo.nodeId, nodeId => {
        /** @type {combinedOrderElementInfo} */
        const elementInfo = {
          hasComplete: false,
          nodeId,
          rank: _.get(requestElementInfo, 'rank', 3),
          uuid: uuidv4(),
        };

        foundRemainInfo.orderElementList.push(elementInfo);
      });
    });

    // BU.CLIN(combinedWrapOrder, 4);
    // 복합 명령 저장
    this.model.saveCombinedOrder(requestCombinedOrder.requestCommandType, combinedWrapOrder);

    // 복합 명령 실행 요청
    return this.submitRequestOrder(combinedWrapOrder);
  }

  /**
   * Data Logger Controller로 실제로 명령을 요청하는 메소드
   * @param {combinedOrderWrapInfo} combinedOrderWrapInfo
   * @memberof Control
   */
  submitRequestOrder(combinedOrderWrapInfo) {
    const {requestCommandId, requestCommandName, requestCommandType} = combinedOrderWrapInfo;

    // 아직 요청 전이므로 orderContainerList 순회하면서 명령 생성 및 요청
    combinedOrderWrapInfo.orderContainerList.forEach(combinedOrderContainerInfo => {
      const {controlValue, controlSetValue} = combinedOrderContainerInfo;

      const hasFirst = true;
      combinedOrderContainerInfo.orderElementList.forEach(combinedOrderElementInfo => {
        if (hasFirst) {
          /** @type {executeOrderInfo} */
          const executeOrder = {
            requestCommandId,
            requestCommandName,
            requestCommandType,
            controlValue,
            controlSetValue,
            nodeId: combinedOrderElementInfo.nodeId,
            rank: combinedOrderElementInfo.rank,
            uuid: combinedOrderElementInfo.uuid,
          };

          const dataLoggerController = this.model.findDataLoggerController(
            combinedOrderElementInfo.nodeId,
          );
          dataLoggerController.orderOperation(executeOrder);
          // hasFirst = false;
        }
      });
    });
  }

  /**
   * 데이터 로거의 현 상태를 조회하는 스케줄러
   */
  runCronDiscoveryRegularDevice() {
    try {
      if (this.cronScheduler !== null) {
        // BU.CLI('Stop')
        this.cronScheduler.stop();
      }
      // 1분마다 요청
      this.cronScheduler = new cron.CronJob({
        cronTime: '0 */1 * * * *',
        onTick: () => {
          this.discoveryRegularDevice();
        },
        start: true,
      });
      return true;
    } catch (error) {
      throw error;
    }
  }

  /** 정기적인 Router Status 탐색 */
  async discoveryRegularDevice() {
    /** @type {requestCombinedOrderInfo} */
    const requestCombinedOrder = {
      requestCommandId: 'discoveryRegularDevice',
      requestCommandName: '정기 장치 상태 계측',
      requestCommandType: requestOrderCommandType.MEASURE,
      requestElementList: [{nodeId: _.map(this.dataLoggerList, 'dl_id')}],
    };

    // BU.CLI(requestCombinedOrder);
    // 명령 요청
    this.executeCombineOrder(requestCombinedOrder);

    // completeDiscovery 이벤트가 발생할때까지 대기
    await eventToPromise.multi(this, ['completeDiscovery'], ['error', 'close']);

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

  /**
   * Data Logger Controller 에서 명령을 처리하였을 경우
   * @param {DataLoggerController} dataLoggerController
   * @param {commandSet} commandSet
   */
  notifyCompleteOrder(dataLoggerController, commandSet) {}

  /**
   * TODO: 데이터 처리
   * Data Logger Controller 로 부터 데이터 갱신이 이루어 졌을때 자동 업데이트 됨.
   * @param {DataLoggerController} dataLoggerController Data Logger Controller 객체
   * @param {dcData} dcData
   */
  notifyData(dataLoggerController, dcData) {}

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
}
module.exports = Control;
