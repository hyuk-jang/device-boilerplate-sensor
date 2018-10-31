require('dotenv').config();
const _ = require('lodash');
const { BU } = require('base-util-jh');
const Control = require('../../../src/Control');
const config = require('../../../src/config');

const control = new Control(config);

control.on('completeDiscovery', () => {
  if (_.every(control.nodeList, nodeInfo => !_.isNil(nodeInfo.data))) {
    BU.CLI('SUCCESS', '모든 장치 데이터 입력 검증 완료');
  } else {
    const result = _.map(control.nodeList, node => _.pick(node, ['node_id', 'data']));
    BU.CLI(result);
    throw new Error('장치에 데이터가 없는게 있음');
  }
});

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
  .then(() => {
    control.setOptionFeature();
    control.inquiryAllDeviceStatus();
    setTimeout(() => {
      BU.CLI(control.model.getAllNodeStatus(['node_id', 'data']));
    }, 3000);
    // return control.runDeviceInquiryScheduler();
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
