const _ = require('lodash');
const {BU} = require('base-util-jh');

const AbstDeviceClient = require('../../device-client-controller-jh');

const Control = require('./Control');

const {BaseModel} = require('../../device-protocol-converter-jh');

class CommunicationMainControl extends AbstDeviceClient {
  /** @param {Control} controller */
  constructor(controller) {
    super();
    this.controller = controller;
    this.config = controller.config;
  }

  /**
   * device client 설정 및 프로토콜 바인딩
   */
  init() {
    this.converter = BaseModel.default;
    // /** 개발 버젼일 경우 Echo Server 구동 */
    // if (this.config.hasDev) {
    //   // const EchoServer = require('device-echo-server-jh');
    //   // 지정된 port로 생성
    //   const echoServer = new EchoServer(this.config.mainSocketInfo.connect_info.port);
    //   // 해당 protocol 파서에 나와있는 객체 생성
    //   echoServer.attachDevice(this.config.mainSocketInfo.protocol_info);
    // }
    // BU.CLI(this.config.deviceInfo);
    this.setDeviceClient(this.config.mainSocketInfo);
  }

  /**
   * TODO: 데이터 전송 메소드 구현
   * DataLogger Default 명령을 내리기 위함
   * @param {{requestCommandType: string=, requestCommandId: string}} executeOrder
   */
  submitToMainServerData(data) {
    try {
      const encodingData = this.converter.encodingDefaultRequestMsgForTransfer(data);

      const commandSet = this.generationAutoCommand(encodingData);

      BU.CLIN(commandSet.cmdList);
      // this.executeCommand(commandSet);
      // hasOneAndOne 이기 때문에 명령 추가 후 다음 스텝으로 이동하라고 명령
      // this.requestTakeAction(this.definedCommanderResponse.NEXT);
      // BU.CLIN(this.manager.findCommandStorage({commandId: requestOrderInfo.requestCommandId}), 4);

      // 명령 요청에 문제가 없으므로 현재 진행중인 명령에 추가
      // this.model.addRequestCommandSet(commandSet);
    } catch (error) {
      BU.CLI(error);
    }
  }

  /**
   * TODO: 장치 접속 시 본 컨트롤러의 식별 코드 전송
   * @override
   * Device Controller 변화가 생겨 관련된 전체 Commander에게 뿌리는 Event
   * @param {dcEvent} dcEvent
   * @example 보통 장치 연결, 해제에서 발생
   * dcConnect --> 장치 연결,
   * dcDisconnect --> 장치 연결 해제
   */
  updatedDcEventOnDevice(dcEvent) {
    super.updatedDcEventOnDevice(dcEvent);

    switch (dcEvent.eventName) {
      // TODO: 연결 시 인증 코드전송
      case this.definedControlEvent.CONNECT:
        break;
      default:
        break;
    }

    // Observer가 해당 메소드를 가지고 있다면 전송
    _.forEach(this.observerList, observer => {
      if (_.get(observer, 'notifyDeviceEvent')) {
        observer.notifyDeviceEvent(this, dcEvent);
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

    switch (dcMessage.msgCode) {
      case this.definedCommandSetMessage.COMMANDSET_EXECUTION_TERMINATE:
      case this.definedCommandSetMessage.COMMANDSET_DELETE:
        break;
      default:
        break;
    }

    // Observer가 해당 메소드를 가지고 있다면 전송
    this.observerList.forEach(observer => {
      if (_.get(observer, 'notifyDeviceMessage')) {
        observer.notifyDeviceMessage(this, dcMessage);
      }
    });
  }

  /**
   * TODO: 서버 측에서의 전송 메시지 응답에 관한 처리
   * TODO: 서버측에서의 명령 요청 수행 처리 메소드 구현
   * 장치로부터 데이터 수신
   * @override
   * @param {dcData} dcData 현재 장비에서 실행되고 있는 명령 객체
   */
  onDcData(dcData) {
    super.onDcData(dcData);
    try {
      const parsedData = this.converter.decodingDefaultRequestMsgForTransfer(dcData.data);

      BU.CLI(parsedData);
      // Device Client로 해당 이벤트 Code를 보냄
      return this.requestTakeAction(this.definedCommanderResponse.DONE);
    } catch (error) {
      BU.logFile(error);
      throw error;
    }
  }
}
module.exports = CommunicationMainControl;
