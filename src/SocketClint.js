const _ = require('lodash');
const {BU} = require('base-util-jh');

const AbstDeviceClient = require('../../device-client-controller-jh');

const Control = require('./Control');

const {BaseModel} = require('../../device-protocol-converter-jh');

const {
  transmitToServerCommandType,
  transmitToClientCommandType,
} = require('../../default-intelligence').dcmWsModel;

class SocketClint extends AbstDeviceClient {
  /** @param {Control} controller */
  constructor(controller) {
    super();
    this.controller = controller;
    this.config = controller.config;
    this.defaultConverter = BaseModel.defaultModule;

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
        transDataToServerInfo.commandType !== transmitToServerCommandType.CERTIFICATION &&
        !this.hasCertification
      ) {
        // BU.CLI('Authentication must be performed first');
        return false;
      }
      // 기본 전송규격 프레임에 넣음
      // BU.CLIF(transDataToServerInfo);
      const encodingData = this.defaultConverter.encodingMsg(transDataToServerInfo);

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
          commandType: transmitToServerCommandType.CERTIFICATION,
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
   * 전송한 데이터가 인증 요청 객체였다면 수신받은 데이터에 따라 인증 결과를 반영
   * @param {dcData} dcData 전송한 데이터 객체
   * @param {Buffer} bufData 디코딩 처리한 수신받은 데이터
   */
  checkCertifyServer(dcData, bufData) {
    // 전송한 데이터가 인증 체크였는지 확인
    const transmitData = _.get(_.head(dcData.commandSet.cmdList), 'data');
    const strData = this.defaultConverter.decodingMsg(transmitData).toString();
    // BU.CLI(strData);

    // 전송은 JSON 형태로 하였기 때문에
    if (!BU.IsJsonString(strData)) {
      return false;
    }

    // JSON 객체로 변환
    /** @type {transDataToServerInfo} */
    const parseData = JSON.parse(strData);

    // 보낸 명령이 CERTIFICATION 타입이라면 체크
    if (parseData.commandType === transmitToServerCommandType.CERTIFICATION) {
      // 응답 코드가 ACK 라면 인증됨
      if (_.isEqual(bufData, this.defaultConverter.protocolConverter.ACK)) {
        BU.CLI('@@@ Authentication is completed from the Socket Server.')
        this.hasCertification = true;
      } else {
        this.hasCertification = false;
      }
      return this.hasCertification;
    }
  }

  /**
   * 수신받은 데이터가 명령 요청인지 체크하고 맞다면 명령을 수행
   * @param {Buffer} bufData
   */
  interpretReceiveData(bufData) {
    // string 으로 변환
    const strData = JSON.parse(bufData.toString());

    // 전송은 JSON 형태로 하였기 때문에 (ClientToServer 메시지의 경우 ACK, CAN 응답이 옴))
    if (!BU.IsJsonString(strData)) {
      return false;
    }

    // JSON 객체로 변환
    /** @type {defaultFormatToRequest} */
    const parseData = JSON.parse(strData);

    try {
      // commandType Key를 가지고 있고 그 Key의 값이 transmitToClientCommandType 안에 들어온다면 명령 요청이라고 판단
      if (_.values(transmitToClientCommandType).includes(_.get(parseData, 'commandId'))) {
        switch (parseData.commandId) {
          case transmitToClientCommandType.SINGLE: // 단일 제어
            this.controller.executeSingleControl(parseData.contents);
            break;
          case transmitToClientCommandType.AUTOMATIC: // 명령 제어
            this.controller.executeSavedCommand(parseData.contents);
            break;
          case transmitToClientCommandType.SCENARIO: // 시나리오
            this.controller.scenario.interpretScenario(parseData.contents);
            break;
          default:
            throw new Error(`commandId: ${parseData.commandId} does not exist.`);
        }
      }
      /** @type {defaultFormatToResponse} */
      const responseMsg = {
        commandId: parseData.commandId,
        uuid: parseData.uuid,
        hasError: false,
        errorStack: '',
        contents: {},
      };
      // 기본 전송 프레임으로 감쌈.
      const encodingMsg = this.defaultConverter.encodingMsg(responseMsg);

      // DCC에 전송 명령
      return this.executeCommand(this.generationAutoCommand(encodingMsg));
    } catch (error) {
      /** @type {defaultFormatToResponse} */
      const responseMsg = {
        commandId: parseData.commandId,
        uuid: parseData.uuid,
        hasError: true,
        errorStack: _.get(error, 'stack'),
        contents: {},
      };
      // 기본 전송 프레임으로 감쌈.
      const encodingMsg = this.defaultConverter.encodingMsg(responseMsg);

      // DCC에 전송 명령
      return this.executeCommand(this.generationAutoCommand(encodingMsg));
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
      const decodingData = this.defaultConverter.decodingMsg(dcData.data);

      // 인증이 되지 않은 상태라면 보낸 명령 체크
      if (!this.hasCertification) {
        this.checkCertifyServer(dcData, decodingData);
      }

      BU.CLI(decodingData);
      this.requestTakeAction(this.definedCommanderResponse.NEXT);
    } catch (error) {
      BU.logFile(error);
      throw error;
    }
  }
}
module.exports = SocketClint;
