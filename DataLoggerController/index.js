const Control = require('./src/Control');

module.exports = Control;

// if __main process
if (require !== undefined && require.main === module) {
  console.log('__main__');
  require('dotenv').config();
  const _ = require('lodash');
  const config = require('./src/config');
  const {BU} = require('base-util-jh');

  const control = new Control(config);
  // control.getDataLoggerInfoByDB({
  //   database: process.env.DB_UPSAS_DB,
  //   host: process.env.DB_UPSAS_HOST,
  //   password: process.env.DB_UPSAS_PW,
  //   port: process.env.DB_UPSAS_PORT,
  //   user: process.env.DB_UPSAS_USER
  // }, {
  //   data_logger_seq: [1],
  //   main_seq: [1]
  // });
  control.s1SetDataLogger(config.dataLoggerInfo);
  control.s1AddNodeList(config.nodeList);
  control.s2SetDeviceInfo();

  control.init();
  control.model.hasAverageStorage = true;
  control.model.bindingAverageStorageForNode([_.nth(config.nodeList, 1)]);

  // BU.CLI(config)

  // cloneConfig.dataLoggerInfo.protocol_info.deviceId = '0013a20040f7ab81';
  // cloneConfig.dataLoggerInfo.dl_id = 'Direct';
  const {UPSAS} = require('../../../module/device-protocol-converter-jh').BaseModel;

  const baseModel = new UPSAS(config.deviceInfo.protocol_info);

  // setTimeout, setInterval
  setTimeout(() => {
    // Node 조회
    control.orderOperation({
      nodeId: 'GV_001',
      hasTrue: undefined,
      requestCommandId: 'TEST',
    });
  }, 1000);

  process.on('uncaughtException', err => {
    // BU.debugConsole();
    console.error(err.stack);
    console.log(err.message);
    console.log('Node NOT Exiting...');
  });

  process.on('unhandledRejection', err => {
    // BU.debugConsole();
    console.error(err.stack);
    console.log(err.message);
    console.log('Node NOT Exiting...');
  });
}
