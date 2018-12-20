require('dotenv').config();
const _ = require('lodash');

const Control = require('../../../src/Control');

const config = require('../../../src/config');
const Main = require('../../../src/Main');

const main = new Main();
const control = main.setControl(config);

// control.on('completeDiscovery', () => {
//   if (_.every(control.nodeList, 'data')) {
//     console.trace('모든 장치 데이터 입력 검증 완료');
//   } else {
//     throw new Error('장치에 데이터가 없는게 있음');
//   }
// });

control
  .getDataLoggerListByDB(
    {
      host: process.env.WEB_DB_HOST,
      port: process.env.WEB_DB_PORT,
      user: process.env.WEB_DB_USER,
      password: process.env.WEB_DB_PW,
      database: process.env.WEB_DB_DB,
    },
    'aaaaa',
  )
  .then(() => control.init())
  .then(DLCs => {
    // setTimeout(() => {
    control.scenarioManager.scenarioMode1(true);
    // }, 2000);
  });

// process.on('uncaughtException', err => {
//   // BU.debugConsole();
//   console.error(err.stack);
//   console.log(err.message);
//   console.log('Node NOT Exiting...');
// });

// process.on('unhandledRejection', err => {
//   // BU.debugConsole();
//   console.error(err.stack);
//   console.log(err.message);
//   console.log('Node NOT Exiting...');
// });
