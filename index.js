const dotenv = require('dotenv');
const Main = require('./src/Main');

module.exports = Main;

// if __main process
if (require !== undefined && require.main === module) {
  console.log('__main__');
  const { BU } = require('base-util-jh');
  const config = require('./src/config');
  const { dbInfo } = config;

  let path;
  switch (process.env.NODE_ENV) {
    case 'development':
      path = `${process.cwd()}/.env`;
      break;
    case 'production':
      path = `${process.cwd()}/.env`;
      break;
    default:
      path = `${process.cwd()}/.env`;
      break;
  }

  dotenv.config({ path });

  const main = new Main();

  const control = main.createControl(config);

  control
    .init(dbInfo, config.uuid)
    .then(() => {
      BU.CLI('Start Program');
      return control.runFeature();
    })
    .then(() => {
      BU.CLI('Start Scheduler');
      // FIXME: 시나리오 테스트
      control.inquiryAllDeviceStatus();
      control.runDeviceInquiryScheduler();
    })
    .catch(err => {
      BU.CLI(err);
      // BU.CLI(err.message);
    });

  process.on('uncaughtException', err => {
    // BU.debugConsole();
    console.error(err.stack);
    console.log(err.message);
    console.log('Node NOT Exiting...');
  });

  process.on('unhandledRejection', err => {
    // BU.debugConsole(10);
    console.error(err.stack);
    console.log(err.message);
    console.log('Node NOT Exiting...');
  });
}
