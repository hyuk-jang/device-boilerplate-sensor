const Control = require('./src/Control');

module.exports = Control;

// if __main process
if (require !== undefined && require.main === module) {
  console.log('__main__');
  require('dotenv').config();
  const _ = require('lodash');
  const config = require('./src/config');
  const { BU } = require('base-util-jh');

  const control = new Control(config);
  // control.getDataLoggerInfoByDB({
  //   database: process.env.WEB_DB_DB,
  //   host: process.env.WEB_DB_HOST,
  //   password: process.env.WEB_DB_PW,
  //   port: process.env.WEB_DB_PORT,
  //   user: process.env.WEB_DB_USER
  // }, {
  //   data_logger_seq: [1],
  //   main_seq: [1]
  // });
  control.s1SetDataLogger(config.dataLoggerInfo);
  control.s1AddNodeList(config.nodeList);
  control.s2SetDeviceInfo();

  control
    .init()
    .then(() => {
      // control.orderOperation({
      //   nodeId: 'GV_001',
      //   singleControlType: 2,
      //   wrapCmdId: 'TEST',
      // });
      control.requestDefaultCommand({});
    })
    .catch(err => {
      BU.CLI(err);
    });

  process.on('uncaughtException', err => {
    // BU.debugConsole();
    BU.CLI(err);
    console.log('Node NOT Exiting...');
  });

  process.on('unhandledRejection', err => {
    // BU.debugConsole();
    BU.CLI(err);
    console.log('Node NOT Exiting...');
  });
}
