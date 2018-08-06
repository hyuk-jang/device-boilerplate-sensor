const _ = require('lodash');
const cron = require('cron');
const Serialport = require('serialport');
const eventToPromise = require('event-to-promise');

const {BU, CU} = require('base-util-jh');

const Control = require('../Control');
const AbstController = require('./AbstController');
const {BaseModel} = require('../../../device-protocol-converter-jh');

const PowerStatusBoard = class extends AbstController {
  /** @param {Control} controller */
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
    this.cronScheduler = null;
  }

  /** AbstController 에서 접속 타이머 시작 요청 */
  tryConnect() {
    this.setInit();
  }

  /**
   * 현황판 데이터 요청 스케줄러
   */
  runCronRequestPowerStatusBoard() {
    try {
      if (this.cronScheduler !== null) {
        // BU.CLI('Stop')
        this.cronScheduler.stop();
      }
      // 1분마다 요청
      this.cronScheduler = new cron.CronJob({
        cronTime: '0 */1 * * * *',
        onTick: () => {
          this.controller.requestPowerStatusBoardInfo();
        },
        start: true,
      });
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Serial Device로 메시지 전송
   * @param {Buffer|string} 전송 데이터
   * @return {Promise} Promise 반환 객체
   */
  write(msg) {
    const realMsg = this.defaultConverter.encodingMsg(msg);
    console.log('realMsg', realMsg);

    if (_.isEmpty(this.client)) {
      throw new Error(`${this.port} ${this.baud_rate} The device is not connected yet.`);
    }

    return new Promise((resolve, reject) => {
      this.client.write(realMsg, err => {
        reject(err);
      });
      resolve();
    });
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

    // 연결되면 즉시 현황판 데이터 요청
    this.controller.requestPowerStatusBoardInfo();
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
};
module.exports = PowerStatusBoard;
