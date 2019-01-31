const Main = require('./src/Main');

module.exports = Main;

// if __main process
if (require !== undefined && require.main === module) {
  console.log('__main__');
  process.env.NODE_ENV = 'development';
  require('dotenv').config();
  const { BU } = require('base-util-jh');
  const config = require('./src/config');
  const { dbInfo } = config;

  const main = new Main();
  // const control = main.createControl({
  //   dbInfo: config.dbInfo,
  // });
  const control = main.createControl(config);
  // control.init();
  control
    .init(dbInfo, config.uuid)
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
