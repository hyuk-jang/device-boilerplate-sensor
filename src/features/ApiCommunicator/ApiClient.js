const _ = require('lodash');

const { BU } = require('base-util-jh');

const DeviceManager = require('../../utils/DeviceManager');

const { BaseModel } = require('../../../../device-protocol-converter-jh');

const {
  transmitToServerCommandType,
  transmitToClientCommandType,
} = require('../../../../default-intelligence').dcmWsModel;

class ApiClient extends DeviceManager {
  /** @param {MainControl} controller */
  constructor(controller) {
    super();
    this.controller = controller;
    /** 기본 Encoding, Decondig 처리를 할 라이브러리 */
    this.defaultConverter = BaseModel.defaultModule;
    // socket Client의 인증 여부
    this.hasCertification = false;
  }

  /** @param {MainControl} controller */
  setControl(controller) {
    this.controller = controller;
  }

  /**
   * 장치로부터 데이터 수신
   * @override
   * @param {bufData} bufData 현재 장비에서 실행되고 있는 명령 객체
   */
  onData(bufData) {
    try {
      // BU.CLI(bufData);
      const decodingData = this.defaultConverter.decodingMsg(bufData);
      const strData = decodingData.toString();

      // 형식을 지켜서 보낸 명령만 대응
      if (BU.IsJsonString(strData)) {
        const parseData = JSON.parse(strData);
        // Error가 있다면 Client에서 보낸 명령에 대한 Response
        if (_.has(parseData, 'isError')) {
          /** @type {defaultFormatToResponse} */
          const responsedDataByServer = parseData;

          switch (responsedDataByServer.commandId) {
            // 보낸 명령이 CERTIFICATION 타입이라면 체크
            case transmitToServerCommandType.CERTIFICATION:
              BU.CLI('@@@ Authentication is completed from the Socket Server.');
              this.hasCertification = responsedDataByServer.isError === 0;
              // 인증이 완료되었다면 현재 노드 데이터를 서버로 보냄
              this.hasCertification && this.transmitStorageDataToServer();
              // 인증이 완료되면 현황판 크론 구동
              this.hasCertification &&
                this.controller.powerStatusBoard.runCronRequestPowerStatusBoard();
              break;
            // 수신 받은 현황판 데이터 전송
            case transmitToServerCommandType.POWER_BOARD:
              this.controller.powerStatusBoard.onDataFromApiClient(
                responsedDataByServer.message,
                responsedDataByServer.contents,
              );
              break;
            default:
              break;
          }
        } else {
          // 요청 받은 명령에 대해서는 NEXT를 수행하지 않고 분석기에게 권한을 넘김
          return this.interpretRequestedCommand(parseData);
        }
      }
    } catch (error) {
      BU.logFile(error);
      throw error;
    }
  }

  // /**
  //  * 메시지 전송
  //  * @param {*} msg 전송 데이터
  //  * @return {Promise.<boolean>} Promise 반환 객체
  //  */
  // write(msg) {}

  /**
   * 초기 구동 개시
   */
  startOperation() {
    // BU.CLI('startOperation');
    // 장치 접속에 성공하면 인증 시도 (1회만 시도로 확실히 연결이 될 것으로 가정함)
    this.transmitDataToServer({
      commandType: transmitToServerCommandType.CERTIFICATION,
      data: this.controller.mainUUID,
    });
  }

  /**
   * @desc DataLogger --> Server 데이터 보고. (보고에 관한 추적은 하지 않으므로 onData 메소드에서 별도의 처리는 하지 않음)
   * DataLogger Default 명령을 내리기 위함
   * @param {transDataToServerInfo} transDataToServerInfo
   */
  transmitDataToServer(transDataToServerInfo = {}) {
    // BU.CLI('transmitDataToServer');
    const { commandType, data } = transDataToServerInfo;
    try {
      // BU.CLI('transDataToServerInfo');
      // 소켓 연결이 되지 않으면 명령 전송 불가
      if (!this.isConnect) {
        throw new Error('The socket is not connected yet.');
      }
      // 인증이 되지 않았는데 별도의 데이터를 보낼 수는 없음
      if (commandType !== transmitToServerCommandType.CERTIFICATION && !this.hasCertification) {
        // BU.CLI('Authentication must be performed first');
        // return false;
        throw new Error('Authentication must be performed first');
      }
      // 기본 전송규격 프레임에 넣음
      // BU.CLIF(transDataToServerInfo);

      /** @type {defaultFormatToRequest} */
      const transmitDataToServer = {
        commandId: commandType,
        contents: data,
      };

      // BU.CLI(transmitDataToServer);

      const encodingData = this.defaultConverter.encodingMsg(transmitDataToServer);

      // BU.CLI(encodingData.toString());
      // 명령 전송 성공 유무 반환
      return this.write(encodingData)
        .then(() => true)
        .catch(err => BU.errorLog('transmitDataToServer', err));
      // this.requestTakeAction(this.definedCommanderResponse.NEXT);
    } catch (error) {
      // console.trace(error.stack);
      BU.errorLog('error', 'transmitDataToServer', error);
    }
  }

  /**
   * Device Controller에서 새로운 이벤트가 발생되었을 경우 알림
   * @param {string} eventName 'dcConnect' 연결, 'dcClose' 닫힘, 'dcError' 에러
   */
  onEvent(eventName) {
    // BU.CLI(eventName);
    const { CONNECT, DISCONNECT } = this.definedControlEvent;

    switch (eventName) {
      case CONNECT:
        this.startOperation();
        break;
      case DISCONNECT:
        this.hasCertification = false;
        break;
      default:
        break;
    }
  }

  /**
   * 서버로 현재 진행중인 데이터(노드, 명령)를 보내줌
   */
  transmitStorageDataToServer() {
    // BU.CLI('transmitStorageDataToServer');
    // this.controller.notifyDeviceData(null, this.controller.nodeList);
    this.transmitDataToServer({
      commandType: transmitToServerCommandType.NODE,
      data: this.controller.model.getAllNodeStatus(),
    });

    this.transmitDataToServer({
      commandType: transmitToServerCommandType.COMMAND,
      data: this.controller.model.contractCmdList,
    });
  }

  /**
   * @desc Server --> DataLogger 명령 수행 요청 처리
   * 수신받은 데이터가 명령 요청인지 체크하고 맞다면 명령을 수행
   * @param {defaultFormatToRequest} dataInfo
   */
  interpretRequestedCommand(dataInfo) {
    BU.CLI('interpretRequestedCommand', dataInfo);
    const { commandId, contents, uuid } = dataInfo;
    /** @type {defaultFormatToResponse} */
    const responseMsg = {
      commandId,
      uuid,
      isError: 0,
      message: '',
      contents: {},
    };

    try {
      // commandType Key를 가지고 있고 그 Key의 값이 transmitToClientCommandType 안에 들어온다면 명령 요청이라고 판단
      if (_.values(transmitToClientCommandType).includes(_.get(dataInfo, 'commandId'))) {
        switch (commandId) {
          case transmitToClientCommandType.SINGLE: // 단일 제어
            this.controller.executeSingleControl(contents);
            break;
          case transmitToClientCommandType.AUTOMATIC: // 명령 제어
            this.controller.executeSavedCommand(contents);
            break;
          case transmitToClientCommandType.SCENARIO: // 시나리오
            this.controller.executeScenario(contents);
            break;
          default:
            throw new Error(`commandId: ${commandId} does not exist.`);
        }
      }
      // 기본 전송 프레임으로 감쌈.
      const encodingMsg = this.defaultConverter.encodingMsg(responseMsg);

      // DCC에 전송 명령
      return this.write(encodingMsg);
    } catch (error) {
      BU.CLI(error);
      responseMsg.isError = 1;
      responseMsg.message = _.get(error, 'message');
      // 기본 전송 프레임으로 감쌈.
      const encodingMsg = this.defaultConverter.encodingMsg(responseMsg);

      // DCC에 전송 명령
      return this.write(encodingMsg);
    }
  }
}
module.exports = ApiClient;
