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
      database: process.env.DB_FP_DB,
      host: process.env.DB_FP_HOST,
      password: process.env.DB_FP_PW,
      port: process.env.DB_FP_PORT,
      user: process.env.DB_FP_USER,
    },
    'aaaaa',
  )
  .then(() => control.init())
  .then(
    () =>
      // BU.CLI('@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
      // setTimeout(() => {
      //   // 장치 전체 탐색
      control.inquiryAllDeviceStatus(),
    // control.runDeviceInquiryScheduler(),

    // control.executeSingleControl({
    //   nodeId: control.nodeList[0].node_id,
    // }),
    // }, 2000);
  )
  .then(() => {
    BU.CLI(control.model.getAllNodeStatus(['node_id', 'data']));
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
