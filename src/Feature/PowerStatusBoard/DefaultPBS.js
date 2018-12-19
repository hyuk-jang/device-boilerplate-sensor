const _ = require('lodash');
const Serialport = require('serialport');
const eventToPromise = require('event-to-promise');

const { BU } = require('base-util-jh');

const ControlDBS = require('../Control');
const AbstController = require('../outsideCommunication/AbstController');
const { BaseModel } = require('../../../device-protocol-converter-jh');

const { dcmWsModel } = require('../../../default-intelligence');

const AbstPBS = require('./AbstPBS');

/**
 * 수중태양광 용 현황판을 보여주기 위함
 * 본래 Boilerplate와는 거리가 있음.
 */
class PowerStatusBoard extends AbstPBS {
  /** @param {ControlDBS} controller */
  constructor(controller) {
    super();
    this.controller = controller;

    // Serial 연결을 하기 위한 정보 설정
    this.baud_rate = controller.config.powerStatusBoardInfo.baudRate;
    this.port = controller.config.powerStatusBoardInfo.port;

    this.configInfo = {
      name: 'PowerStatusBoard',
      port: this.port,
      baud_rate: this.baud_rate,
    };

    /**
     * Serial 연결 객체
     * @type {Serial}
     */
    this.client = {};

    /** 기본 Encoding, Decondig 처리를 할 라이브러리 */
    this.defaultConverter = BaseModel.defaultModule;

    // 현황판 데이터를 요청할 스케줄러
    this.intervalScheduler = null;

    this.socketClient = controller.socketClient;

    this.eventHandler();
  }

  /** AbstController 에서 접속 타이머 시작 요청 */
  tryConnect() {
    BU.CLI('tryConnect PowerStatusBoard');
    this.setInit();
  }

  /** controller에서 eventEmitter 처리 */
  eventHandler() {
    try {
      /** controller 에서 인증 된 경우 발생할 handler */
      this.controller.on('nofityAuthentication', () => {
        BU.CLI('nofityAuthentication');
        this.runCronRequestPowerStatusBoard();
      });

      // 현황판 데이터 수신 완료
      this.controller.on('donePSB', powerStatusBoardData => {
        const bufData = this.defaultConverter.protocolConverter.makeMsg2Buffer(
          powerStatusBoardData,
        );
        // 수신 받은 현황판 데이터 전송

        this.write(bufData);
      });

      // 현황판 데이터 수신 실패
      this.controller.on('errorPSB', error => {
        BU.CLI(error);
        BU.errorLog('powerStatusBoard', error);
      });
    } catch (error) {
      BU.errorLog('powerStatusBoard', error);
    }
  }

  /**
   * @implements
   * 현황판 객체에서 Socket Server로 현황판 데이터를 요청하고 응답받은 데이터를 현황판으로 전송하는 메소드
   */
  async requestPowerStatusBoardInfo() {
    try {
      this.socketClient.transmitDataToServer({
        commandType: dcmWsModel.transmitToServerCommandType.POWER_BOARD,
      });
    } catch (error) {
      BU.errorLog('powerStatusBoard', error);
    }
  }

  /**
   * 초기 구동 개시
   */
  startOperation() {}

  /**
   * 현황판 데이터 요청 스케줄러
   */
  runCronRequestPowerStatusBoard() {
    try {
      if (this.intervalScheduler !== null) {
        // BU.CLI('Stop')
        clearInterval(this.intervalScheduler);
      }

      // 1분마다 요청
      this.intervalScheduler = setInterval(() => {
        this.requestPowerStatusBoardInfo();
      }, 1000 * 60);

      this.requestPowerStatusBoardInfo();

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Serial Device로 메시지 전송
   * @param {Buffer} 전송 데이터
   * @return {Promise} Promise 반환 객체
   */
  write(bufMsg) {
    BU.CLI('현황판 데이터 계측 수신', bufMsg);
    try {
      const writeMsg = Buffer.concat([Buffer.from([0x02]), bufMsg, Buffer.from([0x03])]);

      if (_.isEmpty(this.client)) {
        throw new Error(`${this.port} ${this.baud_rate} The device is not connected yet.`);
      }

      return new Promise((resolve, reject) => {
        this.client.write(writeMsg, err => {
          reject(err);
        });
        resolve();
      });
    } catch (error) {
      BU.errorLog('powerStatusBoard', error);
    }
  }

  /** 장치 접속 시도 */
  async connect() {
    // BU.CLI('Try PowerStatusBoard Connect : ', this.port);
    /** 접속 중인 상태라면 접속 시도하지 않음 */
    if (!_.isEmpty(this.client)) {
      throw new Error(`Already connected. ${this.port}`);
    }

    const client = new Serialport(this.port, {
      baudRate: this.baud_rate,
    });

    client.on('close', err => {
      this.client = {};
      this.notifyDisconnect(err);
    });

    client.on('error', error => {
      this.notifyError(error);
    });

    await eventToPromise.multi(client, ['open'], ['error', 'close']);
    this.client = client;

    return this.client;
  }

  /**
   * Close Connect
   */
  async disconnect() {
    if (!_.isEmpty(this.client)) {
      this.client.close();
      await eventToPromise.multi(this.client, ['close'], ['error', 'disconnectError']);
      return this.client;
    }
    return this.client;
  }
}
module.exports = PowerStatusBoard;
