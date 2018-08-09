const Control = require('./src/Control');

module.exports = Control;

// if __main process
if (require !== undefined && require.main === module) {
  console.log('__main__');
  process.env.NODE_ENV = 'development';
  require('dotenv').config();
  const _ = require('lodash');
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
    .then(() => {
      control.init();

      // setTimeout(() => {
      //   control.discoveryRegularDevice();
      // }, 2000);

      setTimeout(() => {
        control.runCronDiscoveryRegularDevice();
      }, 2000);

      // setTimeout(() => {
      //   control.requestPowerStatusBoardInfo();
      // }, 2000);
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
