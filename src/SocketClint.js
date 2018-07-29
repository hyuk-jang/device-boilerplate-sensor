const _ = require('lodash');
const {BU} = require('base-util-jh');

const AbstDeviceClient = require('../../device-client-controller-jh');

const Control = require('./Control');

const {BaseModel} = require('../../device-protocol-converter-jh');

class SocketClint extends AbstDeviceClient {
  /** @param {Control} controller */
  constructor(controller) {
    super();
    this.controller = controller;
    this.config = controller.config;
    this.converter = BaseModel.defaultModule;
  }

  /**
   * device client 설정 및 프로토콜 바인딩
   */
  init() {
    BU.CLI('init');
    // BU.CLI(this.config.mainSocketInfo);
    // this.setDeviceClient({
    //   target_id: 'SocketClient',
    //   target_category: 'socketClient',
    //   target_name: '6kw TB',
    //   controlInfo: {
    //     hasErrorHandling: false,
    //     hasOneAndOne: true,
    //     hasReconnect: true,
    //   },
    //   logOption: {
    //     hasCommanderResponse: true,
    //     hasDcError: true,
    //     hasDcEvent: true,
    //     hasDcMessage: true,
    //     hasReceiveData: true,
    //     hasTransferCommand: true,
    //   },
    //   connect_info: {
    //     host: 'localhost',
    //     port: '7510',
    //     type: 'socket',
    //     subType: 'parser',
    //     addConfigInfo: {parser: 'delimiterParser', option: this.converter.protocolConverter.EOT},
    //   },
    // });
    this.setDeviceClient(this.config.mainSocketInfo);
  }

  /**
   * DataLogger Default 명령을 내리기 위함
   * @param {transDataToServerInfo} transDataToServerInfo
   */
  transmitDataToServer(transDataToServerInfo) {
    try {
      // 기본 전송규격 프레임에 넣음
      // BU.CLIF(transDataToServerInfo);
      const encodingData = this.converter.encodingMsg(transDataToServerInfo);

      // BU.CLI(encodingData.toString());
      // 명령 요청 포맷으로 변경
      const commandSet = this.generationManualCommand({
        // commandId: this.index,
        commandId: transDataToServerInfo.commandType,
        cmdList: [
          {
            data: encodingData,
            commandExecutionTimeoutMs: 1000,
          },
        ],
      });
      // 명령 전송
      this.executeCommand(commandSet);
    } catch (error) {
      BU.CLI(error);
      throw error;
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
      case this.definedControlEvent.CONNECT:
        break;
      default:
        break;
    }
  }

  /**
   * @override
   * 장치에서 명령을 수행하는 과정에서 생기는 1:1 이벤트
   * @param {dcError} dcError 현재 장비에서 실행되고 있는 명령 객체
   */
  onDcError(dcError) {
    super.onDcError(dcError);
  }

  /**
   * @override
   * 메시지 발생 핸들러
   * @param {dcMessage} dcMessage
   */
  onDcMessage(dcMessage) {
    super.onDcMessage(dcMessage);
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
      const parsedData = this.converter.decodingMsg(dcData.data);
      BU.CLI(parsedData);
      this.requestTakeAction(this.definedCommanderResponse.NEXT);
    } catch (error) {
      BU.logFile(error);
      throw error;
    }
  }
}
module.exports = SocketClint;
