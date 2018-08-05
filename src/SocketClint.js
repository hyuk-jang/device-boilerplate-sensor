const _ = require('lodash');
const split = require('split');
const net = require('net');
const eventToPromise = require('event-to-promise');

const {BU} = require('base-util-jh');

const Control = require('./Control');

const {BaseModel} = require('../../device-protocol-converter-jh');

const {
  transmitToServerCommandType,
  transmitToClientCommandType,
} = require('../../default-intelligence').dcmWsModel;

/** Class Socket 접속 클라이언트 클래스 */
class SocketClient {
  /** @param {Control} controller */
  constructor(controller) {
    this.controller = controller;

    // Main Socket Server로 접속하기 위한 정보 설정
    const connectInfo = controller.config.mainSocketInfo;
    this.mainSocketServerInfo = {
      uuid: controller.config.uuid,
      port: connectInfo.port,
      host: connectInfo.host,
      addConfigInfo: connectInfo.addConfigInfo,
    };

    /**
     * Socket Client 연결 객체
     * @type {net.Socket}
     */
    this.client = {};

    /** 기본 Encoding, Decondig 처리를 할 라이브러리 */
    this.defaultConverter = BaseModel.defaultModule;
    // socket Client의 인증 여부
    this.hasCertification = false;
  }

  /**
   * Parser Pipe 를 붙임
   * @param {Object} client SerialPort Client
   */
  settingParser(client) {
    // BU.CLI('settingParser');

    const parserInfo = this.mainSocketServerInfo.addConfigInfo;
    let stream = null;
    switch (parserInfo.parser) {
      case 'delimiterParser':
        stream = client.pipe(split(parserInfo.option));
        stream.on('data', data => {
          data += parserInfo.option;
          this.onDcData(data);
        });
        break;
      default:
        break;
    }
  }

  /**
   * Socket Server로 메시지 전송
   * @param {Buffer|String} 전송 데이터
   * @return {Promise} Promise 반환 객체
   */
  write(msg) {
    // BU.CLI(msg);
    const res = this.client.write(msg);
    if (res) {
      return Promise.resolve();
    }
    return Promise.reject(res);
  }

  /**
   * @desc DataLogger --> Server 데이터 보고. (보고에 관한 추적은 하지 않으므로 onData 메소드에서 별도의 처리는 하지 않음)
   * DataLogger Default 명령을 내리기 위함
   * @param {transDataToServerInfo} transDataToServerInfo
   */
  transmitDataToServer(transDataToServerInfo) {
    try {
      // BU.CLI(transDataToServerInfo);
      // 소켓 연결이 되지 않으면 명령 전송 불가
      if (_.isEmpty(this.client)) {
        throw new Error('The socket is not connected yet.');
      }
      // 인증이 되지 않았는데 별도의 데이터를 보낼 수는 없음
      if (
        transDataToServerInfo.commandType !== transmitToServerCommandType.CERTIFICATION &&
        !this.hasCertification
      ) {
        // BU.CLI('Authentication must be performed first');
        // return false;
        throw new Error('Authentication must be performed first');
      }
      // 기본 전송규격 프레임에 넣음
      // BU.CLIF(transDataToServerInfo);

      /** @type {defaultFormatToRequest} */
      const transmitDataToServer = {
        commandId: transDataToServerInfo.commandType,
        contents: transDataToServerInfo.data,
      };

      // BU.CLI(transmitDataToServer);

      const encodingData = this.defaultConverter.encodingMsg(transmitDataToServer);

      // BU.CLI(encodingData.toString());
      // 명령 전송 성공 유무 반환
      return this.write(encodingData)
        .then(() => true)
        .catch(err => err);
      // this.requestTakeAction(this.definedCommanderResponse.NEXT);
    } catch (error) {
      BU.CLI(error);
      throw error;
    }
  }

  /**
   * 장치로부터 데이터 수신
   * @override
   * @param {bufData} bufData 현재 장비에서 실행되고 있는 명령 객체
   */
  onDcData(bufData) {
    // BU.CLI(bufData);
    try {
      const decodingData = this.defaultConverter.decodingMsg(bufData);
      const strData = decodingData.toString();
      // BU.CLI(strData);

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
    } catch (error) {
      BU.logFile(error);
      throw error;
    }
  }

  /**
   * @desc Server --> DataLogger 명령 수행 요청 처리
   * 수신받은 데이터가 명령 요청인지 체크하고 맞다면 명령을 수행
   * @param {defaultFormatToRequest} dataInfo
   */
  interpretRequestedCommand(dataInfo) {
    BU.CLI('interpretRequestedCommand', dataInfo);
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
      return this.write(encodingMsg);
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
      return this.write(encodingMsg);
    }
  }

  /** 장치 접속 시도 */
  async connect() {
    BU.log('Try Connect : ', this.mainSocketServerInfo.port);
    /** 접속 중인 상태라면 접속 시도하지 않음 */
    if (!_.isEmpty(this.client)) {
      throw new Error(`Already connected. ${this.mainSocketServerInfo.port}`);
    }

    const client = net.createConnection(
      this.mainSocketServerInfo.port,
      this.mainSocketServerInfo.host,
    );

    this.settingParser(client);

    // client.on('data', bufferData => {
    //   this.notifyData(bufferData);
    // });

    client.on('close', err => {
      this.hasCertification = false;
      this.client = {};
      // 장치 접속이 끊겼을 경우 재접속
      setTimeout(() => {
        this.connect();
      }, 1000 * 20);
    });

    client.on('end', () => {
      // console.log('Client disconnected');
    });

    client.on('error', error => {
      client.emit('close', error);
    });
    await eventToPromise.multi(client, ['connect', 'connection', 'open'], ['close', 'error']);
    this.client = client;

    // 장치 접속에 성공하면 인증 시도 (1회만 시도로 확실히 연결이 될 것으로 가정함)
    this.transmitDataToServer({
      commandType: transmitToServerCommandType.CERTIFICATION,
      data: this.mainSocketServerInfo.uuid,
    });

    return this.client;
  }

  /**
   * Close Connect
   */
  async disconnect() {
    if (!_.isEmpty(this.client)) {
      this.client.destroy(() => this.client);
    } else {
      return this.client;
    }
  }
}

module.exports = SocketClient;
