const Control = require('./src/Control');

module.exports = Control;

// if __main process
if (require !== undefined && require.main === module) {
  console.log('__main__');
  process.env.NODE_ENV = 'development';
  require('dotenv').config();
  const _ = require('lodash');
  const moment = require('moment');
  const config = require('./src/config');
  const {BU} = require('base-util-jh');

  const control = new Control(config);
  // control.init();
  control
    .getDataLoggerListByDB(
      {
        database: process.env.DB_UPSAS_DB,
        host: process.env.DB_UPSAS_HOST,
        password: process.env.DB_UPSAS_PW,
        port: process.env.DB_UPSAS_PORT,
        user: process.env.DB_UPSAS_USER,
      },
      config.uuid,
    )
    .then(
      () => {
        control.init();
        control.setSocketClient();
        control.setPowerStatusBoard();
      },

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
      // control.discoveryRegularDevice(moment());
      control.runCronDiscoveryRegularDevice();
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
