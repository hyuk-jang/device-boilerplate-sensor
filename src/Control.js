'use strict';

const cron = require('cron');
const _ = require('lodash');
const { BU } = require('base-util-jh');

// const Model = require('./Model');

require('../../default-intelligence');

const DataLoggerController =  require('../DataLoggerController');

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
  }

  
  /**
   * @desc Step 1
   * DB에서 특정 데이터를 가져오고 싶을경우
   * @param {dbInfo} dbInfo 
   * @param {{main_seq: number=}} where Logger Sequence
   */
  async getDataLoggerListByDB(dbInfo, where) {
    const bmjh = require('../../base-model-jh');
    const BM = new bmjh.BM(dbInfo);


    /** @type {dataLoggerConfig[]} */
    let returnValue = [];

    this.dataLoggerList = await BM.getTable('v_data_logger', where, true);
    this.nodeList = await BM.getTable('v_node_profile', where, true);

    // 리스트를 돌면서 데이터 로거에 속해있는 Node를 세팅함
    this.dataLoggerList.forEach(dataLoggerInfo => {
      /** @type {dataLoggerConfig} */
      let loggerConfig = {};
      
      let findedNodeList = _.filter(this.nodeList, nodeInfo => {
        return nodeInfo.data_logger_seq === dataLoggerInfo.data_logger_seq;
      });
      dataLoggerInfo.protocol_info = JSON.parse(_.get(dataLoggerInfo, 'protocol_info'));
      dataLoggerInfo.connect_info = JSON.parse(_.get(dataLoggerInfo, 'connect_info'));

      loggerConfig.dataLoggerInfo = dataLoggerInfo;
      loggerConfig.nodeList = findedNodeList;
      loggerConfig.hasDev = false;
      loggerConfig.deviceInfo = {};

      returnValue.push(loggerConfig);
    });

    this.config.dataLoggerList = returnValue;
    // _.set(this.config, 'dataLoggerList', returnValue)
    BU.CLI(returnValue);
    
    // BU.CLI(file);
    // BU.writeFile('out.json', file);
  }


  /**
   * Data logger와 연결되어 있는 컨트롤러를 반환
   * @param {dataLoggerInfo|string} searchValue Node ID 또는 DataLogger 객체
   * @return {DataLoggerController}
   */
  findDataLoggerController(searchValue) {
    // Node Id 일 경우
    if(_.isString(searchValue)){
      let nodeInfo = _.find(this.nodeList, {node_id: searchValue});
      if(_.isEmpty(nodeInfo)){
        throw new Error(`Node ID: ${searchValue} is not exist`);
      }
      // searchValue 에 데이터로거 세팅
      searchValue = nodeInfo.getDataLogger();
    }
    return _.find(this.dataLoggerControllerList, router => _.isEqual(router.dataLoggerInfo, searchValue));
  }

  /**
   * 데이터 로거 객체를 생성하고 초기화를 진행
   * 1. setDeviceInfo --> controlInfo 정의 및 logOption 정의, deviceInfo 생성
   * 2. DCM, DPC, Model 정의
   * 3. Commander를 Observer로 등록
   * 4. 생성 객체를 routerList에 삽입
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
    if(dcEvent.eventName === dataLoggerController.definedControlEvent.CONNECT){
      _.remove(this.preparingDataLoggerControllerList, preDataLogger => _.isEqual(preDataLogger, dataLoggerController));
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
      // if(requestOrderInfo.dl_id) {
      //   // Data Logger Controller 객체를 찾음
      //   let foundIt = _.find(this.dataLoggerList, {dl_id: requestOrderInfo.dl_id});
      //   if(_.isEmpty(foundIt)){
      //     throw new Error(`DL ID: ${requestOrderInfo.dl_id} is not exist`);
      //   } else {
      //     let foundDataLoggerController = this.findDataLoggerController(foundIt);
      //     foundDataLoggerController.orderOperation(requestOrderInfo);
      //   }
      // } else {
      
      let foundDataLoggerController = this.findDataLoggerController(requestOrderInfo.nodeId);
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
  excuteAutomaticControl(controlInfo) {
    BU.CLI(controlInfo);
    let orderList = [];
    // 배열 병합
    let commandList = {0: controlInfo.falseList, 1: controlInfo.trueList};
    // 명령 생성 및 요청
    _.forEach(commandList, (modelId, key) => {
      /** @type {requestOrderInfo} */
      let orderInfo = {
        requestCommandId: controlInfo.cmdName,
        requestCommandType: 'ADD',
        nodeId: modelId,
        controlValue: key,
        rank: 2,
      };
      let foundDataLoggerController = this.findDataLoggerController(modelId);
      foundDataLoggerController.orderOperation(orderInfo);
    });

    return orderList;
  }

  /**
   * FIXME: 임시로 해둠
   * @param {{cmdName: string, trueList: string[], falseList: string[]}} controlInfo 
   */
  cancelAutomaticControl(controlInfo){
    let orderList = [];
    controlInfo.trueList = _.reverse(controlInfo.trueList);
    // 동작 시켰던 장치들을 순회
    controlInfo.trueList.forEach(modelId => {
      // 명령 타입은 취소
      let orderInfo = {
        requestCommandId: controlInfo.cmdName,
        requestCommandType: 'CANCEL',
        nodeId: modelId,
        controlValue: 0,
        rank: 2,
      };
      let foundDataLoggerController = this.findDataLoggerController(modelId);
      foundDataLoggerController.orderOperation(orderInfo);
    });

    return orderList;
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
  discoveryRegularDevice(){
    // Data Logger 현재 상태 조회
    this.dataLoggerControllerList.forEach(router => {
      /** @type {requestOrderInfo} */
      let ruquestOrder = {};
      ruquestOrder.nodeId = 'DEFAULT';
      ruquestOrder.requestCommandType = 'ADD';
      ruquestOrder.requestCommandId = 'regularDiscovery';
      
      router.orderOperationDefault(ruquestOrder);
    });
  }


  /**
   * Saltern Device로 부터 데이터 갱신이 이루어 졌을때 자동 업데이트 됨.
   * @param {SalternDevice} salternDevice 
   */
  notifyData(salternDevice) {
    this.model.onData(salternDevice);

    // this.socketServer.
    let commandStorage = this.model.commandStorage;

    const currentCommandSet = this.model.commandStorage.currentCommandSet;

    const nodeModelName = _.find(salternDevice.nodeModelList, ele => ele.includes('MRT'));

    // if(nodeModelName.length){
    //   let res = _.find(deviceStorage, {targetId: nodeModelName}).
    // }

    // TEMP DB에 데이터를 저장하기 위하여 임시로 때려 박음
    // 정기 데이터 수집일 경우
    
    // if(currentCommandSet.commandId === 'regularDiscovery'){
    //   if(_.includes(currentCommandSet.commandName.includes('R_') ) )

    // }
    



    
    let deviceStorage = this.model.getAllDeviceModelStatus();
    BU.CLI(commandStorage);
    BU.CLI(deviceStorage);

    this.socketServer.emitToClientList({commandStorage, deviceStorage});
  }

    
  /**
   * Device Client로부터 Error 수신
   * @param {dcError} dcError 명령 수행 결과 데이터
   */
  notifyDeviceEvent(dcError, salternDevice){
    this.model.onData(salternDevice);
    
    let commandStorage = this.model.commandStorage;
    let deviceStorage = this.model.getAllDeviceModelStatus();
    BU.CLI(commandStorage);
    BU.CLI(deviceStorage);

    this.socketServer.emitToClientList({commandStorage, deviceStorage});
  }
  
  /**
   * Device Client로부터 Error 수신
   * @param {dcError} dcError 명령 수행 결과 데이터
   */
  notifyError(dcError, salternDevice){
    this.model.onData(salternDevice);
    
    let commandStorage = this.model.commandStorage;
    let deviceStorage = this.model.getAllDeviceModelStatus();
    BU.CLI(commandStorage);
    BU.CLI(deviceStorage);

    this.socketServer.emitToClientList({commandStorage, deviceStorage});
  }



}
module.exports = Control;