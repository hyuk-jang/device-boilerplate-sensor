require('dotenv').config();
const _ = require('lodash');

const { BU } = require('base-util-jh');
const moment = require('moment');

const Control = require('../../src/Control');

const control = new Control();

/**
 *
 * @param {nodeInfo[]} nodeList
 */
function testInsertDB(nodeList) {
  // 5개 장치만 불러옴
  const dumpList = nodeList.slice(0, 5);

  // TEST: 입력된 시간을 순차적으로 1분씩 뺌
  let permitValue = 0;
  // 0, 1, 2, 3, 4 분을 각각 차를 적용했음
  dumpList.forEach(nodeInfo => {
    nodeInfo.writeDate = moment(nodeInfo.writeDate)
      .subtract(permitValue, 'minutes') // subtract는 Integer에 가깝게 내림처리됨. ex) min 이 1.78 정도의 수치라면 1.
      .toDate();
    permitValue += 1;
  });

  BU.CLI(dumpList);

  // 날짜 차이를 통한 List Filter
  const remainList = control.model.checkValidateNodeData(dumpList, {
    diffType: 'minutes',
    duration: 2,
  });
  if (remainList.length !== 3) {
    throw new Error(`날짜 유효성 검증 실패 expect: 3, result: ${remainList.length}`);
  }
  console.trace('날짜 차를 통한 데이터 유효성 검증 테스트 완료');

  control.model.insertNodeDataToDB(nodeList);
}

control.on('completeDiscovery', () => {
  if (_.every(control.nodeList, 'data')) {
    console.trace('모든 장치 데이터 입력 검증 완료');
    testInsertDB(control.nodeList);
  } else {
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
    'aaaaa',
  )
  .then(() => {
    testInsertDB(control.nodeList);
    // control.inquiryAllDeviceStatus();
  });

// setTimeout(() => {
//   control.discoveryRegularDevice();
// }, 2000);
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
