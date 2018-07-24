require('dotenv').config();
const _ = require('lodash');

const Control = require('../../src/Control');
const config = require('../../src/config');

const control = new Control(config);

control.on('completeDiscovery', () => {
  if (_.every(control.nodeList, 'data')) {
    console.trace('모든 장치 데이터 입력 검증 완료');
  } else {
    throw new Error('장치에 데이터가 없는게 있음');
  }
});

control
  .getDataLoggerListByDB(
    {
      database: process.env.DB_UPSAS_DB,
      host: process.env.DB_UPSAS_HOST,
      password: process.env.DB_UPSAS_PW,
      port: process.env.DB_UPSAS_PORT,
      user: process.env.DB_UPSAS_USER,
    },
    'aaaaa',
  )
  .then(() => {
    control.init();
    setTimeout(() => {
      control.discoveryRegularDevice();
    }, 2000);
  });

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
