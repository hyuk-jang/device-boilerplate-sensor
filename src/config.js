require('dotenv').config();
// const {integratedDataLoggerConfig} = require('../../default-intelligence').dcmConfigModel;

const { controllerParserType } = require('../../default-intelligence').dccFlagModel;

/** @type {integratedDataLoggerConfig} */
const config = {
  projectInfo: {
    projectMainId: 'UPSAS',
    projectSubId: 'muan',
  },
  /** @type {dbInfo} */
  dbInfo: {
    /** 접속 주소 구동 */
    host: '',
    /** user ID */
    user: 'root',
    /** user password */
    password: '',
    /** 사용할 port */
    port: 3306,
    /** 사용할 database */
    database: '',
  },
  uuid: 'aaaaa',
  inquirySchedulerInfo: {
    intervalCronFormat: '0 * * * * *',
    intervalSaveCnt: 1,
    validInfo: {
      diffType: 'minutes',
      duration: 2,
    },
  },
  mainSocketInfo: {
    host: process.env.WEB_HTTP_HOST,
    port: process.env.WEB_SOCKET_PORT,
    type: 'socket',
    addConfigInfo: {
      parser: controllerParserType.socket.DELIMITER,
      option: Buffer.from([0x04]),
    },
  },
  powerStatusBoardInfo: {
    /**
     * @type {number=} Serial baud_rate
     * @defaultvalue 9600
     */
    baudRate: 9600,
    /**
     * @type {string|number=} 대분류가 serial, socket, zigbee일 경우에 사용
     * @example
     * serial, zigbee --> windows(COM1~), linux(...)
     * socket --> socket port
     */
    port: 'COM17',
  },
  dataLoggerList: [],
};
module.exports = config;
