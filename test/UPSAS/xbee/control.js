require('dotenv').config();
const _ = require('lodash');
const { BU } = require('base-util-jh');

const { reqWrapCmdType, nodePickKey } = require('../../../../default-intelligence').dcmConfigModel;

const config = require('./config');
const Main = require('../../../src/Main');

const main = new Main();
const control = main.createControl(config);

const testDumpCmd = {
  cmdName: '증발지1 -> 저수지1',
  trueList: ['WD_005', 'V_002', 'GV_001'],
  falseList: ['WD_009', 'V_003', 'P_002'],
};

const testDumpCmd2 = {
  cmdName: '증발지1 -> 저수지1 취소',
  trueList: ['WD_005', 'V_002'],
  falseList: ['WD_009', 'V_003', 'P_002', 'GV_001'],
};

// const testDumpCmd2 = {
//   cmdName: '증발지1 -> 저수지1 취소',
//   trueList: ['WD_005', 'WD_006', 'WD_007', 'GV_001', 'P_005', 'V_002'],
//   falseList: ['WD_009', 'V_003', 'GV_004', 'P_002'],
// };

// 명령 제어 요청 체크
function checkDumpCmd() {
  const nodeStatusList = control.model.getAllNodeStatus(nodePickKey.FOR_DATA);
  // BU.CLI(nodeStatusList);

  const trueList = _.filter(nodeStatusList, nodeInfo =>
    _.includes(testDumpCmd.trueList, nodeInfo.node_id),
  );

  // BU.CLI(trueList);

  const hasAllTrue = _.every(
    trueList,
    nodeInfo => nodeInfo.data === 'OPEN' || nodeInfo.data === 'ON',
  );

  const falseList = _.filter(nodeStatusList, nodeInfo =>
    _.includes(testDumpCmd.falseList, nodeInfo.node_id),
  );

  // BU.CLI(falseList);

  const hasAllFalse = _.every(
    falseList,
    nodeInfo => nodeInfo.data === 'CLOSE' || nodeInfo.data === 'OFF',
  );

  if (hasAllTrue && hasAllFalse) {
    BU.CLI('모든 장비 제어 예상값과 동일');

    // 명령 취소 요청
    // setTimeout(() => {
    control.cancelAutomaticControl(testDumpCmd2);
    // }, 500);
  } else {
    throw new Error('장비 중에 제대로 동작 안한게 있음');
  }
}

// 명령 취소 체크
function checkDumpCmd2() {
  const nodeStatusList = control.model.getAllNodeStatus();

  const trueList = _.filter(nodeStatusList, nodeInfo =>
    _.includes(testDumpCmd2.trueList, nodeInfo.node_id),
  );

  const hasAllTrue = _.every(
    trueList,
    nodeInfo => nodeInfo.data === 'CLOSE' || nodeInfo.data === 'OFF',
  );

  BU.CLI(control.model.getAllNodeStatus(nodePickKey.FOR_DATA));
  BU.CLI(hasAllTrue);

  // 닫는거는 하지 않음
  // const falseList = _.filter(nodeStatusList, nodeInfo =>
  //   _.includes(testDumpCmd2.falseList, nodeInfo.node_id),
  // );

  // const hasAllFalse = _.every(
  //   falseList,
  //   nodeInfo => nodeInfo.data === 'CLOSE' || nodeInfo.data === 'OFF',
  // );

  if (hasAllTrue) {
    BU.CLI('모든 장비 취소 예상값과 동일');
  } else {
    throw new Error('장비 중에 취소 동작 안한게 있음');
  }
}

control.on('completeOrder', commandId => {
  if (commandId === testDumpCmd.cmdName) {
    checkDumpCmd();
  } else if (commandId === testDumpCmd2.cmdName) {
    checkDumpCmd2();
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
    'aaaaa',
  )
  .then(() => {
    setTimeout(() => {
      // 명령 제어 요청
      BU.CLI('명령 제어 요청');
      control.executeAutomaticControl(testDumpCmd);
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
