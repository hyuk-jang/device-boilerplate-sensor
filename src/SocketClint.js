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
   * @desc DataLogger --> Server 데이터 보고. (보고에 관한 추적은 하지 않으므로 onData 메소드에서 별도의 처리는 하지 않음)
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

      /** @type {defaultFormatToRequest} */
      const transmitDataToServer = {
        commandId: transDataToServerInfo.commandType,
        contents: transDataToServerInfo.data,
      };

      const encodingData = this.defaultConverter.encodingMsg(transmitDataToServer);

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
   * @desc Server --> DataLogger 명령 수행 요청 처리
   * 수신받은 데이터가 명령 요청인지 체크하고 맞다면 명령을 수행
   * @param {defaultFormatToRequest} dataInfo
   */
  interpretRequestedCommand(dataInfo) {
    try {
      // commandType Key를 가지고 있고 그 Key의 값이 transmitToClientCommandType 안에 들어온다면 명령 요청이라고 판단
      if (_.values(transmitToClientCommandType).includes(_.get(dataInfo, 'commandId'))) {
        switch (dataInfo.commandId) {
          case transmitToClientCommandType.SINGLE: // 단일 제어
            this.controller.executeSingleControl(dataInfo.contents);
            break;
          case transmitToClientCommandType.AUTOMATIC: // 명령 제어
            this.controller.executeSavedCommand(dataInfo.contents);
            break;
          case transmitToClientCommandType.SCENARIO: // 시나리오
            this.controller.scenario.interpretScenario(dataInfo.contents);
            break;
          default:
            throw new Error(`commandId: ${dataInfo.commandId} does not exist.`);
        }
      }
      /** @type {defaultFormatToResponse} */
      const responseMsg = {
        commandId: dataInfo.commandId,
        uuid: dataInfo.uuid,
        isError: 0,
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
        commandId: dataInfo.commandId,
        uuid: dataInfo.uuid,
        isError: 1,
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
   * 장치로부터 데이터 수신
   * @override
   * @param {dcData} dcData 현재 장비에서 실행되고 있는 명령 객체
   */
  onDcData(dcData) {
    super.onDcData(dcData);
    try {
      const decodingData = this.defaultConverter.decodingMsg(dcData.data);
      const strData = decodingData.toString();

      // 형식을 지켜서 보낸 명령만 대응
      if (BU.IsJsonString(strData)) {
        const parseData = JSON.parse(strData);
        // Error가 있다면 Client에서 보낸 명령에 대한 Response
        if (_.has(parseData, 'isError')) {
          /** @type {defaultFormatToResponse} */
          const responsedDataByServer = parseData;
          // 보낸 명령이 CERTIFICATION 타입이라면 체크
          if (responsedDataByServer.commandId === transmitToServerCommandType.CERTIFICATION) {
            // 에러가 아니라면 인증된것으로 정의
            BU.CLI('@@@ Authentication is completed from the Socket Server.');
            this.hasCertification = responsedDataByServer.isError === 0;
          }
        } else {
          // 요청 받은 명령에 대해서는 NEXT를 수행하지 않고 분석기에게 권한을 넘김
          return this.interpretRequestedCommand(parseData);
        }
      }

      // 어찌됐든 수신을 받으면
      this.requestTakeAction(this.definedCommanderResponse.NEXT);
    } catch (error) {
      BU.logFile(error);
      throw error;
    }
  }
}
module.exports = SocketClint;
