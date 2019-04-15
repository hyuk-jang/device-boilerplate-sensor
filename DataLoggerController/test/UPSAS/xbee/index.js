process.env.NODE_ENV = 'production';
require('dotenv').config();
const _ = require('lodash');
const { BU } = require('base-util-jh');

const config = require('./config');
const Control = require('../../../src/Control');

const control = new Control(config);

control.s1SetDataLogger(config.dataLoggerInfo);
control.s1AddNodeList(config.nodeList);
control.s2SetDeviceInfo();

control.init();
control.model.hasAverageStorage = true;
// control.model.bindingAverageStorageForNode([_.nth(config.nodeList, 1)]);

setTimeout(() => {
  // DataLogger 조회
  // BU.CLIN(control.manager.deviceController);
  control.orderOperationToDataLogger({ wrapCmdId: 'test' });
}, 1000);

// setTimeout(() => {
//   _.forEach(control.nodeList, nodeInfo => {
//     if (nodeInfo.data === undefined) {
//       throw new Error(`nodeId: ${nodeInfo.node_id} 의 데이터가 존재하지 않습니다.`);
//     }
//   });
// }, 2000);
process.on('uncaughtException', err => {
  // BU.debugConsole();
  console.trace(err);
  BU.logFile(JSON.stringify(err));
  console.log('Node NOT Exiting...');
});

process.on('unhandledRejection', err => {
  // BU.debugConsole();
  console.trace(err);
  BU.logFile(JSON.stringify(err));
  console.log('Node NOT Exiting...');
});
