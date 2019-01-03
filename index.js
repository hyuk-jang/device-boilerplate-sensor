const Main = require('./src/Main');
const Control = require('./src/Control');

module.exports = Main;

// if __main process
if (require !== undefined && require.main === module) {
  console.log('__main__');
  process.env.NODE_ENV = 'development';
  require('dotenv').config();
  const _ = require('lodash');
  const moment = require('moment');
  const config = require('./src/config');
  const { BU } = require('base-util-jh');

  const Main = require('./src/Main');
  const main = new Main();
  // const control = main.createControl({
  //   dbInfo: config.dbInfo,
  // });
  const control = main.createControl(config);
  // control.init();
  control
    .getDataLoggerListByDB(
      {
        host: process.env.WEB_DB_HOST,
        port: process.env.WEB_DB_PORT,
        user: process.env.WEB_DB_USER,
        password: process.env.WEB_DB_PW,
        database: process.env.WEB_DB_DB,
      },
      config.uuid,
    )
    .then(
      () => control.init(),

      // setTimeout(() => {
      //   control.executeSingleControl({
      //     nodeId: 'V_001',
      //     controlValue: 2,
      //   });
      // }, 1000);

      // setTimeout(() => {
      //   control.discoveryRegularDevice(moment());
      // }, 1000);
      // setTimeout(() => {
      //   control.requestPowerStatusBoardInfo();
      // }, 2000);
    )
    .then(dataLoggerControllerList => {
      BU.CLI('start Program');
      // BU.CLIN(dataLoggerControllerList);
      // const dataLogger = control.model.findDataLoggerController('WL_001');
      // control.executeSingleControl({
      //   controlValue: 2,
      //   nodeId: 'V_001',
      // });
      // control.inquiryAllDeviceStatus(moment());
      // control.runDeviceInquiryScheduler();
    })
    .catch(err => {
      BU.CLI(err);
    });

  process.on('uncaughtException', err => {
    // BU.debugConsole();
    console.error(err.stack);
    console.log(err.message);
    console.log('Node NOT Exiting...');
  });

  process.on('unhandledRejection', err => {
    // BU.debugConsole();
    BU.CLI(err);
    console.log('Node NOT Exiting...');
  });
}
