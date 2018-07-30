const _ = require('lodash');
const {BU} = require('base-util-jh');

const AbstDeviceClient = require('../../device-client-controller-jh');

const Control = require('./Control');

const {BaseModel} = require('../../device-protocol-converter-jh');

const {transmitCommandType} = require('../../default-intelligence').dcmWsModel;

class SocketClint extends AbstDeviceClient {
  /** @param {Control} controller */
  constructor(controller) {
    super();
    this.controller = controller;
    this.config = controller.config;
    this.converter = BaseModel.defaultModule;

    // socket Client의 인증 여부
    this.hasCertification = false;
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
      // 인증이 되지 않았는데 별도의 데이터를 보낼 수는 없음
      BU.CLI(transDataToServerInfo);
      if (
        transDataToServerInfo.commandType !== transmitCommandType.CERTIFICATION &&
        !this.hasCertification
      ) {
        // BU.CLI('Authentication must be performed first');
        return false;
      }
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
   * FIXME: UUID를 통한 식별 처리. RSA 인증이 필요할 듯 (2018-07-30)
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
        this.transmitDataToServer({
          commandType: transmitCommandType.CERTIFICATION,
          data: this.config.uuid,
        });
        break;
      // 장치와의 접속이 해제되었다면 인증여부를 false로 바꿈
      case this.definedControlEvent.DISCONNECT:
        this.hasCertification = false;
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
   *
   * @param {dcData} dcData
   * @param {Buffer} parsedData
   */
  checkCertification(dcData, parsedData) {
    const requestData = _.get(_.head(dcData.commandSet.cmdList), 'data');

    const strData = this.converter.decodingMsg(requestData).toString();
    // BU.CLI(strData);

    // 전송은 JSON 형태로 하였기 때문에
    if (!BU.IsJsonString(strData)) {
      return false;
    }

    // JSON 객체로 변환
    /** @type {transDataToServerInfo} */
    const parseData = JSON.parse(strData);

    // 보낸 명령이 CERTIFICATION 타입이라면 체크
    if (parseData.commandType === transmitCommandType.CERTIFICATION) {
      // 응답 코드가 ACK 라면 인증됨
      if (_.isEqual(parsedData, this.converter.protocolConverter.ACK)) {
        this.hasCertification = true;
      } else {
        this.hasCertification = false;
      }
    }
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

      // 인증이 되지 않은 상태라면 보낸 명령 체크
      if (!this.hasCertification) {
        this.checkCertification(dcData, parsedData);
      }

      BU.CLI(parsedData);
      this.requestTakeAction(this.definedCommanderResponse.NEXT);
    } catch (error) {
      BU.logFile(error);
      throw error;
    }
  }
}
module.exports = SocketClint;
