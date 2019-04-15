require('dotenv').config();
const _ = require('lodash');
const { BU } = require('base-util-jh');

const config = require('./config');
const Control = require('../../../src/Control');

const control = new Control(config);

control.s1SetLoggerAndNodeByConfig();
control.s2SetDeviceInfo();

control.init().then(c => {
  // BU.CLIN(c);
  // setInterval(() => {
  //   control.orderOperation({ wrapCmdId: 'test' });
  // }, 1000);
  setTimeout(() => {
    control.requestCommand({ wrapCmdId: 'test' });
  }, 1000);
});
control.model.hasAverageStorage = true;
// control.model.bindingAverageStorageForNode([_.nth(config.nodeList, 1)]);

// setTimeout(() => {
//   // DataLogger 조회
//   // BU.CLIN(control.manager.deviceController);
//   control.orderOperation({ wrapCmdId: 'test' });
//   // control.orderOperationToDataLogger({ wrapCmdId: 'test' });
// }, 1000);

// setTimeout(() => {
//   _.forEach(control.nodeList, nodeInfo => {
//     if (nodeInfo.data === undefined) {
//       throw new Error(`nodeId: ${nodeInfo.node_id} 의 데이터가 존재하지 않습니다.`);
//     }
//   });
// }, 2000);
