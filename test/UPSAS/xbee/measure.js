require('dotenv').config();
const _ = require('lodash');
const { BU } = require('base-util-jh');
const config = require('./config');
const Main = require('../../../src/Main');

const main = new Main();
const control = main.createControl(config);

control.on('completeInquiryAllDeviceStatus', () => {
  const result = _(control.nodeList)
    .filter(nodeInfo => _.includes(['sensor', 'device'], nodeInfo.save_db_type))
    .map(nodeInfo => _.pick(nodeInfo, ['node_id', 'data']))
    .sortBy('node_id')
    .value();

  if (_.every(result, nodeInfo => !_.isNil(nodeInfo.data))) {
    // BU.CLI(result);
    BU.CLI('SUCCESS', '모든 장치 데이터 입력 검증 완료');
  } else {
    // const result = _.map(control.nodeList, node => _.pick(node, ['node_id', 'data']));
    BU.CLI(result);
    throw new Error('장치에 데이터가 없는게 있음');
  }
});

control
  .init(
    {
      port: process.env.PJ_DB_PORT || '3306',
      host: process.env.PJ_DB_HOST || 'localhost',
      user: process.env.PJ_DB_USER || 'root',
      password: process.env.PJ_DB_PW || 'test',
      database: process.env.PJ_DB_DB || 'test',
    },
    config.uuid,
  )
  .then(() => {
    control.runFeature();

    setTimeout(() => {
      control.inquiryAllDeviceStatus();
      // BU.CLI(control.model.getAllNodeStatus(['node_id', 'data']));
    }, 1000);
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
