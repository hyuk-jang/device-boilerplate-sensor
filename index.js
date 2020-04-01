const dotenv = require('dotenv');
const Main = require('./src/Main');

module.exports = Main;

// if __main process
if (require !== undefined && require.main === module) {
  console.log('__main__');
  const { BU } = require('base-util-jh');
  const config = require('./src/config');
  const scenarioList = require('./test/UPSAS/muan100kW/scenarioList');
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
  // const control = main.createControl({
  //   dbInfo: config.dbInfo,
  // });
  const control = main.createControl(config);
  // control.init();
  control
    .init(dbInfo, config.uuid)
    .then(() => {
      BU.CLI('start Program');
      return control.runFeature();
    })
    .then(() => {
      // FIXME: 시나리오 테스트
      control.model.scenarioManager.scenarioCmdList = scenarioList;
      control.executeScenarioControl({ wrapCmdId: 'vipFlowScenario' });

      // control.inquiryAllDeviceStatus();
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
