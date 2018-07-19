const Control = require('./src/Control');

module.exports = Control;

// if __main process
if (require !== undefined && require.main === module) {
  console.log('__main__');

  require('dotenv').config();
  const _ = require('lodash');
  const config = require('./src/config');
  const {
    BU
  } = require('base-util-jh');

  const control = new Control(config);
  control.getDataLoggerListByDB({
      database: process.env.DB_UPSAS_DB,
      host: process.env.DB_UPSAS_HOST,
      password: process.env.DB_UPSAS_PW,
      port: process.env.DB_UPSAS_PORT,
      user: process.env.DB_UPSAS_USER
    }, {
      main_seq: 1
    })
    .then(() => {
      control.init();

      setTimeout(() => {
        control.discoveryRegularDevice();
      }, 2000);

      // setTimeout(() => {
      //   control.runCronDiscoveryRegularDevice();
      // }, 2000);
    })

  return;
  control.setDeviceInfo();
  control.init();
  control.model.hasAverageStorage = true;
  control.model.bindingAverageStorageForNode([_.nth(config.nodeList, 1)]);





  process.on('uncaughtException', function (err) {
    // BU.debugConsole();
    console.error(err.stack);
    console.log(err.message);
    console.log('Node NOT Exiting...');
  });


  process.on('unhandledRejection', function (err) {
    // BU.debugConsole();
    console.error(err.stack);
    console.log(err.message);
    console.log('Node NOT Exiting...');
  });
}