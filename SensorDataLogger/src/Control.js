'use strict';

const _ = require('lodash');
const { BU } = require('base-util-jh');

// const AbstDeviceClient = require('device-client-controller-jh');
const AbstDeviceClient = require('../../../device-client-controller-jh');

const Model = require('./Model');

// const { AbstConverter, BaseModel } = require('device-protocol-converter-jh');
const {MainConverter, BaseModel} = require('../../../device-protocol-converter-jh');

require('../../../default-intelligence');
// const {AbstConverter} = require('device-protocol-converter-jh');

class Control extends AbstDeviceClient {
  /** @param {dataLoggerConfig} config */
  constructor(config) {
    super();

    this.config = config;
    this.BaseModel = BaseModel;

    
    // Model deviceData Prop 정의
    this.observerList = [];
  }

  /**
   * 컨트롤러 ID를 가져올 경우
   * @return {string} Device Controller를 대표하는 ID
   */
  get id() {
    return this.config.deviceInfo.target_id;
  }

  /**
   * DB에 저장할 경우 분류 단위
   * @return {string}
   */
  get category() {
    return this.config.deviceInfo.target_category;
  }


  /**
   * @desc Step 1
   * DB에서 특정 데이터를 가져오고 싶을경우
   * @param {dbInfo} dbInfo 
   * @param {{data_logger_seq: number, main_seq: number}} where Logger Sequence
   */
  async getDataLoggerInfoByDB(dbInfo, where) {
    const bmjh = require('base-model-jh');
    const BM = new bmjh.BM(dbInfo);
    let dataLoggerInfo = await BM.db.single(`SELECT * FROM v_data_logger WHERE data_logger_seq = ${where.data_logger_seq} AND main_seq = ${where.main_seq} `);
    const nodeList = await BM.db.single(`SELECT * FROM v_node_profile WHERE data_logger_seq = ${where.data_logger_seq} AND main_seq = ${where.main_seq} `);
    this.config.dataLoggerInfo = dataLoggerInfo;
    this.config.nodeList = nodeList;

    dataLoggerInfo = _.head(dataLoggerInfo);
    dataLoggerInfo.protocol_info = JSON.parse(_.get(dataLoggerInfo, 'protocol_info'));
    dataLoggerInfo.connect_info = JSON.parse(_.get(dataLoggerInfo, 'connect_info'));

    const file = {
      dataLoggerInfo,
      nodeList
    };
    // BU.CLI(file);
    // BU.writeFile('out.json', file);
  }

  /** 
   * @desc Step 2
   * config.dataLoggerInfo 를 deviceInfo로 변환하여 저장 
   */
  setDeviceInfo() {
    this.config.deviceInfo = {
      target_id: this.config.dataLoggerInfo.dl_id,
      // target_category: 'Saltern',
      target_name: this.config.dataLoggerInfo.target_alias,
      connect_info: this.config.dataLoggerInfo.connect_info,
      protocol_info: this.config.dataLoggerInfo.protocol_info,
      controlInfo: {
        hasErrorHandling: true,
        hasOneAndOne: false,
        hasReconnect: true
      },
      logOption: {
        hasCommanderResponse: true,
        hasDcError: true,
        hasDcEvent: true,
        hasDcMessage: true,
        hasReceiveData: true,
        hasTransferCommand: true
      }
    };
  }



  /** 
   * @desc Step 3
   * device client 설정 및 프로토콜 바인딩
   */
  init() {
    let protocol_info = _.get(this.config, 'deviceInfo.protocol_info');
    this.converter = new MainConverter(protocol_info);
    this.baseModel = new BaseModel.UPSAS(protocol_info);
    this.deviceModel = this.baseModel.device;
    this.nodeList = this.config.nodeList;

    // 모델 선언
    this.model = new Model(this);

    /** 개발 버젼일 경우 Echo Server 구동 */
    if (this.config.hasDev) {
      const EchoServer = require('../../../device-echo-server-jh');
      // const EchoServer = require('device-echo-server-jh');
      // 지정된 port로 생성
      const echoServer = new EchoServer(
        this.config.deviceInfo.connect_info.port
      );
      // 해당 protocol 파서에 나와있는 객체 생성
      echoServer.attachDevice(this.config.deviceInfo.protocol_info);
    }
    BU.CLI(this.config.deviceInfo);
    this.setDeviceClient(this.config.deviceInfo);
    this.converter.setProtocolConverter();
  }

  /**
   * Observer Pattern을 사용할 경우 추가
   * @desc Parent Boileplate를 사용할 경우 자동 추가
   * @param {Object} parent
   */
  attach(parent) {
    this.observerList.push(parent);
  }

  /**
   * 장치의 현재 데이터 및 에러 내역을 가져옴
   */
  getDeviceOperationInfo() {
    return {
      id: this.config.deviceInfo.target_id,
      config: this.config.deviceInfo,
      nodeList: this.nodeList,
      // systemErrorList: [{code: 'new Code2222', msg: '에러 테스트 메시지22', occur_date: new Date() }],
      systemErrorList: this.systemErrorList,
      troubleList: [],
      measureDate: new Date()
    };
  }

  /**
   * 외부에서 명령을 내릴경우
   * @param {requestOrderInfo} requestOrderInfo
   */
  orderOperation(requestOrderInfo) {
    try {
      let nodeInfo = _.find(this.nodeList, {node_id: requestOrderInfo.nodeId});
      // let modelId = orderInfo.modelId;
      if(_.isEmpty(nodeInfo)){
        throw new Error(`Node ${requestOrderInfo.nodeId} 장치는 존재하지 않습니다.`);
      }

      let cmdList = this.converter.generationCommand({
        key: nodeInfo.nc_target_id,
        value: _.get(requestOrderInfo, 'controlValue') 
      });

      let cmdName = `${nodeInfo.node_name} ${nodeInfo.node_id} Type: ${requestOrderInfo.hasTrue}`;
      // 장치를 열거나 
      let rank = requestOrderInfo.controlValue === 1 || requestOrderInfo.controlValue === 0 ? this.definedCommandSetRank.SECOND : this.definedCommandSetRank.THIRD;

      // BU.CLI(cmdList);
      if (this.config.deviceInfo.connect_info.type === 'socket') {
        cmdList.forEach(currentItem => {
          currentItem.data = JSON.stringify(currentItem.data);
        });
      }

      let commandSet = this.generationManualCommand({
        cmdList: cmdList,
        commandId: requestOrderInfo.commandId,
        commandName: cmdName,
        commandType: requestOrderInfo.commandType,
        rank
      });

      this.executeCommand(commandSet);
    } catch (error) {
      BU.CLI(error);
    }
  }

  /**
   * @override
   * Device Controller 변화가 생겨 관련된 전체 Commander에게 뿌리는 Event
   * @param {dcEvent} dcEvent
   * @example 보통 장치 연결, 해제에서 발생
   * dcConnect --> 장치 연결,
   * dcDisconnect --> 장치 연결 해제
   */
  updatedDcEventOnDevice(dcEvent) {
    super.updatedDcEventOnDevice(dcEvent);

    // Error가 발생하면 추적 중인 데이타는 폐기
    this.converter.resetTrackingDataBuffer();
    // Observer가 해당 메소드를 가지고 있다면 전송
    _.forEach(this.observerList, observer => {
      if (_.get(observer, 'notifyDevicEvent')) {
        observer.notifyDevicEvent(this);
      }
    });
  }

  /**
   * @override
   * 장치에서 명령을 수행하는 과정에서 생기는 1:1 이벤트
   * @param {dcError} dcError 현재 장비에서 실행되고 있는 명령 객체
   */
  onDcError(dcError) {
    super.onDcError(dcError);

    // Error가 발생하면 추적 중인 데이터는 폐기 (config.deviceInfo.protocol_info.protocolOptionInfo.hasTrackingData = true 일 경우 추적하기 때문에 Data를 계속 적재하는 것을 방지함)
    this.converter.resetTrackingDataBuffer();
    // Observer가 해당 메소드를 가지고 있다면 전송
    _.forEach(this.observerList, observer => {
      if (_.get(observer, 'notifyDeviceError')) {
        observer.notifyDeviceError(this, dcError);
      }
    });
  }

  /**
   * @override
   * 메시지 발생 핸들러
   * @param {dcMessage} dcMessage
   */
  onDcMessage(dcMessage) {
    super.onDcMessage(dcMessage);
    // Observer가 해당 메소드를 가지고 있다면 전송
    this.observerList.forEach(observer => {
      if (_.get(observer, 'notifyDeviceMessage')) {
        observer.notifyDeviceMessage(this);
      }
    });
  }

  /**
   * 장치로부터 데이터 수신
   * @override
   * @param {dcData} dcData 현재 장비에서 실행되고 있는 명령 객체
   */
  onDcData(dcData) {
    // BU.CLIN(dcData);
    
    super.onDcData(dcData);
    try {
      // BU.CLI('data', dcData.data.toString());


      // TEST 개발용 Socket 일 경우 데이터 처리
      if (this.config.deviceInfo.connect_info.type === 'socket') {
        // 데이터 형태가 Buffer 일 경우에만 변환
        dcData.data = JSON.parse(dcData.data.toString());
        dcData.data.data = Buffer.from(dcData.data.data);
        // BU.CLI(dcData.data);
      }

      const parsedData = this.converter.parsingUpdateData(dcData);

      // BU.CLI(parsedData);
      // 만약 파싱 에러가 발생한다면 명령 재 요청
      if (parsedData.eventCode === this.definedCommanderResponse.ERROR) {
        return this.requestTakeAction(this.definedCommanderResponse.RETRY);
      }

      parsedData.eventCode === this.definedCommanderResponse.DONE &&
        this.model.onData(parsedData.data);

      BU.CLIN(this.getDeviceOperationInfo().nodeList);
      // Device Client로 해당 이벤트 Code를 보냄
      return this.requestTakeAction(parsedData.eventCode);
    } catch (error) {
      BU.CLI(error);
      BU.logFile(error);
    }
  }
}
module.exports = Control;
