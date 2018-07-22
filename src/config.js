// const {integratedDataLoggerConfig} = require('../../default-intelligence').dcmConfigModel;

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
  dataLoggerList: [],
};
module.exports = config;
