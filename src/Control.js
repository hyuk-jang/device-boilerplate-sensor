'use strict';

const cron = require('cron');
const _ = require('lodash');
const { BU } = require('base-util-jh');

// const Model = require('./Model');

require('../../default-intelligence');

const SensorDataLogger =  require('../SensorDataLogger');

class Control {
  /** @param {dataLoggerConfig} config */
  constructor(config) {
    
    this.config = config;
    
    /** @type {SensorDataLogger[]} */
    this.routerList = [];

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

    /** @type {dataLoggerInfo[]}  */
    let dataLoggerList = await BM.getTable('v_data_logger', where, true);
    /** @type {nodeInfo[]} */
    const nodeList = await BM.getTable('v_node_profile', where, true);

    
    this.config.dataLoggerList = dataLoggerList;

    // 리스트를 돌면서 데이터 로거에 속해있는 Node를 세팅함
    dataLoggerList.forEach(dataLoggerInfo => {
      /** @type {dataLoggerConfig} */
      let loggerConfig = {};
      
      let findedNodeList = _.filter(nodeList, nodeInfo => {
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
    BU.CLI(returnValue);
    
    // BU.CLI(file);
    // BU.writeFile('out.json', file);
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
      const sensorDataLogger = new SensorDataLogger(dataLoggerConfig);

      // deviceInfo 설정
      sensorDataLogger.setDeviceInfo();
      // DeviceClientController, ProtocolConverter, Model 초기화
      sensorDataLogger.init();

      sensorDataLogger.attach(this);
      // 하부 DataLogger Controller을 router라고 부르고 리스트에 삽입
      this.routerList.push(sensorDataLogger);
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
  discoveryRegularDevice(){
    // Data Logger 현재 상태 조회
    this.routerList.forEach(router => {
      /** @type {requestOrderInfo} */
      let ruquestOrder = {};
      ruquestOrder.nodeId = 'DEFAULT';
      ruquestOrder.requestCommandType = 'ADD';
      ruquestOrder.requestCommandId = 'regularDiscovery';
      
      router.orderOperation(ruquestOrder);
    });
  }



}
module.exports = Control;