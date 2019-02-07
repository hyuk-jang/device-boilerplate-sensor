require('dotenv').config();
const _ = require('lodash');

const config = require('../../../src/config');
const Main = require('../../../src/Main');

const main = new Main();
const control = main.createControl(config);

// control.on('completeInquiryAllDeviceStatus', () => {
//   if (_.every(control.nodeList, 'data')) {
//     console.trace('모든 장치 데이터 입력 검증 완료');
//   } else {
//     throw new Error('장치에 데이터가 없는게 있음');
//   }
// });

control
  .init(
    {
      port: process.env.PJ_DB_PORT || '3306',
      host: process.env.PJ_DB_HOST || 'localhost',
      user: process.env.PJ_DB_USER || 'root',
      password: process.env.PJ_DB_PW || 'test',
      database: process.env.PJ_DB_DB || 'test',
    },
    'aaaaa',
  )
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
