const uuidv4 = require('uuid/v4');
const cron = require('cron');
const _ = require('lodash');
const {BU} = require('base-util-jh');
const bmjh = require('../../base-model-jh');
// const Model = require('./Model');

const {
  requestCommandType,
  requestDeviceControlType,
} = require('../../default-intelligence').dcmConfigModel;

const DataLoggerController = require('../DataLoggerController');

const Model = require('./Model');

class Control {
  /** @param {integratedDataLoggerConfig} config */
  constructor(config) {
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

    this.model = new Model(this);
  }

  /**
   * @desc Step 1
   * DB에서 특정 데이터를 가져오고 싶을경우
   * @param {dbInfo} dbInfo
   * @param {{main_seq: number=}} where Logger Sequence
   */
  async getDataLoggerListByDB(dbInfo, where) {
    const BM = new bmjh.BM(dbInfo);

    /** @type {dataLoggerConfig[]} */
    const returnValue = [];

    this.dataLoggerList = await BM.getTable('v_data_logger', where, true);
    this.nodeList = await BM.getTable('v_node_profile', where, true);

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

    this.config.dataLoggerList = returnValue;
    // _.set(this.config, 'dataLoggerList', returnValue)
    // BU.CLI(returnValue);

    // BU.CLI(file);
    // BU.writeFile('out.json', file);
  }

  /**
   * Data logger와 연결되어 있는 컨트롤러를 반환
   * @param {dataLoggerInfo|string} searchValue string: dl_id, node_id or Object: DataLogger
   * @return {DataLoggerController}
   */
  findDataLoggerController(searchValue) {
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
          throw new Error(`Node ID: ${searchValue} is not exist`);
        }
        searchValue = nodeInfo.getDataLogger();
      }
    }
    return _.find(this.dataLoggerControllerList, router =>
      _.isEqual(router.dataLoggerInfo, searchValue),
    );
  }

  /**
   * 데이터 로거 객체를 생성하고 초기화를 진행
   * 1. setDeviceInfo --> controlInfo 정의 및 logOption 정의, deviceInfo 생성
   * 2. DCM, DPC, Model 정의
   * 3. Commander 를 Observer로 등록
   * 4. 생성 객체를 routerLists 에 삽입
   */
  init() {
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
   * @param {requestOrderInfo} requestOrderInfo
   */
  excuteSingleControl(requestOrderInfo) {
    try {
      // Data Logger ID가 존재한다면 해당 로거를 직접 호출
      // if(requestOrderInfo.dlId) {
      //   // Data Logger Controller 객체를 찾음
      //   let foundIt = _.find(this.dataLoggerList, {dlId: requestOrderInfo.dlId});
      //   if(_.isEmpty(foundIt)){
      //     throw new Error(`DL ID: ${requestOrderInfo.dlId} is not exist`);
      //   } else {
      //     let foundDataLoggerController = this.findDataLoggerController(foundIt);
      //     foundDataLoggerController.orderOperation(requestOrderInfo);
      //   }
      // } else {

      const foundDataLoggerController = this.findDataLoggerController(requestOrderInfo.nodeId);
      foundDataLoggerController.orderOperation(requestOrderInfo);
      // }
    } catch (error) {
      BU.errorLog('excuteControl', 'Error', error);
    }
  }

  /**
   * FIXME: 임시로 해둠.
   * @param {{cmdName: string, trueList: string[], falseList: string[]}} controlInfo
   */
  executeAutomaticControl(controlInfo) {
    BU.CLI(controlInfo);
    const orderList = [];
    // 배열 병합
    const commandList = {
      0: controlInfo.falseList,
      1: controlInfo.trueList,
    };
    // 명령 생성 및 요청
    _.forEach(commandList, (modelId, key) => {
      /** @type {requestOrderInfo} */
      const orderInfo = {
        requestCommandId: controlInfo.cmdName,
        requestCommandType: CONTROL,
        nodeId: modelId,
        controlValue: key,
        rank: 2,
      };
      const foundDataLoggerController = this.findDataLoggerController(modelId);
      foundDataLoggerController.orderOperation(orderInfo);
    });

    return orderList;
  }

  /**
   * FIXME: 임시로 해둠
   * @param {{cmdName: string, trueList: string[], falseList: string[]}} controlInfo
   */
  cancelAutomaticControl(controlInfo) {
    const orderList = [];
    controlInfo.trueList = _.reverse(controlInfo.trueList);
    // 동작 시켰던 장치들을 순회
    controlInfo.trueList.forEach(modelId => {
      // 명령 타입은 취소
      const orderInfo = {
        requestCommandId: controlInfo.cmdName,
        requestCommandType: requestCommandType.CANCEL,
        nodeId: modelId,
        controlValue: 0,
        rank: 2,
      };
      const foundDataLoggerController = this.findDataLoggerController(modelId);
      foundDataLoggerController.orderOperation(orderInfo);
    });

    return orderList;
  }

  /**
   * 복합 명령 실행 요청
   * @param {requestCombinedOrder} requestCombinedOrder
   * @memberof Control
   */
  excuteCombineOrder(requestCombinedOrder) {
    // TODO: requestCombinedOrder의 실행 가능 여부 체크 메소드 구현

    /** @type {combinedOrderWrapInfo} */
    const combinedWrapOrder = {
      requestCommandId: requestCombinedOrder.requestCommandId,
      requestCommandType: requestCombinedOrder.requestCommandType,
      requestCommandName: requestCombinedOrder.requestCommandName,
      orderContainerList: [],
    };

    // 요청 복합 명령 객체의 요청 리스트를 순회하면서 combinedOrderContainerInfo 객체를 만들고 삽입
    requestCombinedOrder.requestOrderList.forEach(requestOrderInfo => {
      // controlValue가 없다면 기본 값 2(Stauts)를 입력
      const controlValue =
        requestOrderInfo.controlValue === undefined
          ? requestDeviceControlType.MEASURE
          : requestOrderInfo.controlValue;
      // 해당 controlValue가 orderElementList 기존재하는지 체크
      let foundRemainInfo = _.find(combinedWrapOrder.orderContainerList, {
        controlValue,
      });
      // 없다면
      if (!foundRemainInfo) {
        /** @type {combinedOrderContainerInfo} */
        const container = {
          controlValue,
          controlSetValue: requestOrderInfo.controlSetValue,
          orderElementList: [],
        };
        foundRemainInfo = container;
        combinedWrapOrder.orderContainerList.push(container);
      }
      // nodeId가 string이라면 배열생성 후 집어넣음
      requestOrderInfo.nodeId = Array.isArray(requestOrderInfo.nodeId)
        ? requestOrderInfo.nodeId
        : [requestOrderInfo.nodeId];
      // 배열을 반복하면서 element를 생성 후 remainInfo에 삽입
      _.forEach(requestOrderInfo.nodeId, nodeId => {
        /** @type {combinedOrderElementInfo} */
        const elementInfo = {
          hasComplete: false,
          nodeId,
          rank: _.get(requestOrderInfo, 'rank', 3),
          uuid: uuidv4(),
        };

        foundRemainInfo.orderElementList.push(elementInfo);
      });
    });

    // BU.CLIN(combinedWrapOrder, 4);
    // 복합 명령 저장
    this.model.saveCombinedOrder(requestCombinedOrder.requestCommandType, combinedWrapOrder);

    // 복합 명령 실행 요청
    this.submitRequestOrder(combinedWrapOrder);
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

      let hasFirst = true;
      combinedOrderContainerInfo.orderElementList.forEach(combinedOrderElementInfo => {
        if (hasFirst) {
          /** @type {requestOrderInfo} */
          const requestOrder = {
            requestCommandId,
            requestCommandName,
            requestCommandType,
            controlValue,
            controlSetValue,
            nodeId: combinedOrderElementInfo.nodeId,
            rank: combinedOrderElementInfo.rank,
            uuid: combinedOrderElementInfo.uuid,
          };

          const dataLoggerController = this.findDataLoggerController(
            combinedOrderElementInfo.nodeId,
          );
          dataLoggerController.orderOperation(requestOrder);
          hasFirst = false;
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
  discoveryRegularDevice() {
    /** @type {requestCombinedOrder} */
    const requestCombinedOrder = {
      requestCommandId: 'discoveryRegularDevice',
      requestCommandName: '정기 장치 상태 계측',
      requestCommandType: requestCommandType.MEASURE,
      requestOrderList: [{nodeId: _.map(this.dataLoggerList, 'dl_id')}],
    };

    // BU.CLI(requestCombinedOrder);
    this.excuteCombineOrder(requestCombinedOrder);

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
   * @param {dataLoggerController} dataLoggerController
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
