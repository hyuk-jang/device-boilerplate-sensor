// const {integratedDataLoggerConfig} = require('../../default-intelligence').dcmConfigModel;

const {controllerParserType} = require('../../default-intelligence').dccFlagModel;

/** @type {integratedDataLoggerConfig} */
const config = {
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
  mainSocketInfo: {
    target_id: '',
    target_category: 'upsas',
    target_name: 'Main Socket Server',
    controlInfo: {
      hasErrorHandling: true,
      hasOneAndOne: true,
      hasReconnect: true,
    },
    logOption: {
      hasCommanderResponse: true,
      hasDcError: true,
      hasDcEvent: true,
      hasDcMessage: true,
      hasReceiveData: true,
      hasTransferCommand: true,
    },
    connect_info: {
      host: process.env.DB_UPSAS_HOST,
      port: process.env.SOCKET_UPSAS_PORT,
      type: 'socket',
      addConfigInfo: {
        parser: controllerParserType.socket.DELIMITER,
        option: Buffer.from([0x04]),
      },
    },
  },
  dataLoggerList: [],
};
module.exports = config;
