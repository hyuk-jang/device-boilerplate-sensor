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
  /** @param {sensorDataLoggerConfig} config */
  constructor(config) {
    super();

    this.config = config;
    this.BaseModel = BaseModel;

    this.converter = new MainConverter(
      _.get(this.config, 'dataLoggerInfo.protocol_info')
    );

    this.baseModel = new BaseModel.Saltern(
      _.get(this.config, 'dataLoggerInfo.protocol_info')
    );
    this.deviceModel = this.baseModel.device;

    this.sensorList = config.sensorList;

    // 모델 선언
    this.model = new Model(this);
    // Model deviceData Prop 정의
    this.observerList = [];
  }

  /** config.dataLoggerInfo 를 deviceInfo로 변환하여 저장 */
  setDeviceInfo() {
    this.config.deviceInfo = {
      target_id: this.config.dataLoggerInfo.sdl_id,
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

  /** device client 설정 및 프로토콜 바인딩 */
  init() {
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
      data: this.model.deviceData,
      // systemErrorList: [{code: 'new Code2222', msg: '에러 테스트 메시지22', occur_date: new Date() }],
      systemErrorList: this.systemErrorList,
      troubleList: this.model.deviceData.operTroubleList,
      measureDate: new Date()
    };
  }

  /**
   * 외부에서 명령을 내릴경우
   * @param {{commandType: string, hasTrue: boolean, modelId: string, commandId: string, rank: number=}} orderInfo
   */
  //  * @param {commandInfo[]} commandInfoList 명령은 완결된 commandInfo[] 형식을 갖쳐야함
  orderOperation(orderInfo) {
    BU.CLI(orderInfo);
    try {
      let modelId = orderInfo.modelId;
      let oper;
      let cmdName;
      let rank = this.definedCommandSetRank.SECOND;

      if (orderInfo.hasTrue === true) {
        if (_.includes(modelId, 'WD_')) {
          oper = this.deviceModel.WATER_DOOR.COMMAND.OPEN;
          cmdName = `${this.deviceModel.WATER_DOOR.NAME} ${modelId} ${
            this.deviceModel.WATER_DOOR.STATUS.OPEN
          }`;
        } else if (_.includes(modelId, 'P_')) {
          oper = this.deviceModel.PUMP.COMMAND.ON;
          cmdName = `${this.deviceModel.PUMP.NAME} ${modelId} ${
            this.deviceModel.PUMP.STATUS.ON
          }`;
        } else if (_.includes(modelId, 'V_') || _.includes(modelId, 'SV_')) {
          oper = this.deviceModel.VALVE.COMMAND.OPEN;
          cmdName = `${this.deviceModel.VALVE.NAME} ${modelId} ${
            this.deviceModel.VALVE.STATUS.OPEN
          }`;
        }
      } else if (orderInfo.hasTrue === false) {
        if (_.includes(modelId, 'WD_')) {
          oper = this.deviceModel.WATER_DOOR.COMMAND.CLOSE;
          cmdName = `${this.deviceModel.WATER_DOOR.NAME} ${modelId} ${
            this.deviceModel.WATER_DOOR.STATUS.CLOSE
          }`;
        } else if (_.includes(modelId, 'P_')) {
          oper = this.deviceModel.PUMP.COMMAND.OFF;
          cmdName = `${this.deviceModel.PUMP.NAME} ${modelId} ${
            this.deviceModel.PUMP.STATUS.OFF
          }`;
        } else if (_.includes(modelId, 'V_') || _.includes(modelId, 'SV_')) {
          oper = this.deviceModel.VALVE.COMMAND.CLOSE;
          cmdName = `${this.deviceModel.VALVE.NAME} ${modelId} ${
            this.deviceModel.VALVE.STATUS.CLOSE
          }`;
        }
      } else {
        rank = this.definedCommandSetRank.THIRD;
        if (_.includes(modelId, 'WD_')) {
          oper = this.deviceModel.WATER_DOOR.COMMAND.STATUS;
          cmdName = `${this.deviceModel.WATER_DOOR.NAME} ${modelId} STATUS`;
        } else if (_.includes(modelId, 'P_')) {
          oper = this.deviceModel.PUMP.COMMAND.STATUS;
          cmdName = `${this.deviceModel.PUMP.NAME} ${modelId} STATUS`;
        } else if (_.includes(modelId, 'V_') || _.includes(modelId, 'SV_')) {
          oper = this.deviceModel.VALVE.COMMAND.STATUS;
          cmdName = `${this.deviceModel.VALVE.NAME} ${modelId} STATUS`;
        } else {
          oper = this.deviceModel.VALVE.COMMAND.STATUS;
          cmdName = `순회 탐색 ${this.id} STATUS`;
        }
      }

      /** @type {Array.<commandInfo>} */
      let cmdList = this.converter.generationCommand(oper);
      // BU.CLI(cmdList);
      if (this.config.deviceInfo.connect_info.type === 'socket') {
        cmdList.forEach(currentItem => {
          currentItem.data = JSON.stringify(currentItem.data);
        });
      }

      let commandSet = this.generationManualCommand({
        cmdList: cmdList,
        commandId: orderInfo.commandId,
        commandName: cmdName,
        commandType: orderInfo.commandType,
        rank
      });

      // let commandSet = this.generationManualCommand({
      //   cmdList: commandInfoList,
      //   commandId: this.id
      // });

      // BU.CLIN(commandSet);

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
      BU.CLI('data', dcData.data.toString());


      // TEST 개발용 Socket 일 경우 데이터 처리
      if (this.config.deviceInfo.connect_info.type === 'socket') {
        // 데이터 형태가 Buffer 일 경우에만 변환
        dcData.data = JSON.parse(dcData.data.toString());
        BU.CLI(dcData.data);
        dcData.data.data = Buffer.from(dcData.data.data);
        BU.CLI(dcData.data);
      }

      const parsedData = this.converter.parsingUpdateData(dcData);

      // BU.CLI(parsedData);
      // 만약 파싱 에러가 발생한다면 명령 재 요청
      if (parsedData.eventCode === this.definedCommanderResponse.ERROR) {
        return this.requestTakeAction(this.definedCommanderResponse.RETRY);
      }

      parsedData.eventCode === this.definedCommanderResponse.DONE &&
        this.model.onData(parsedData.data);

      // BU.CLIN(this.getDeviceOperationInfo().data);
      // Device Client로 해당 이벤트 Code를 보냄
      return this.requestTakeAction(parsedData.eventCode);
    } catch (error) {
      BU.CLI(error);
      BU.logFile(error);
    }
  }
}
module.exports = Control;
