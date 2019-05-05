require('dotenv').config();
const _ = require('lodash');
const { expect } = require('chai');

const eventToPromise = require('event-to-promise');

const { BU } = require('base-util-jh');
const config = require('./config');
const Main = require('../../../src/Main');

const MuanControl = require('../../../src/projects/UPSAS/muan/MuanControl');

const { dcmWsModel, dcmConfigModel } = require('../../../../default-intelligence');

const {
  complexCmdStep,
  nodePickKey,
  complexCmdPickKey,
  controlModeInfo,
  goalDataRange,
  nodeDataType,
  reqWrapCmdType,
  requestDeviceControlType,
} = dcmConfigModel;

process.env.NODE_ENV = 'development';

const { dbInfo } = config;

// const main = new Main();
// const control = main.createControl({
//   dbInfo: config.dbInfo,
// });
// const control = main.createControl(config);
const control = new MuanControl(config);

describe('Manual Mode', function() {
  this.timeout(10000);
  before(async () => {
    await control.init(dbInfo, config.uuid);
    control.runFeature();
    control.controlMode = controlModeInfo.MANUAL;
    // BU.CLI(control.model.complexCmdList);
  });

  /**
   * @desc T.C 1 [수동 모드]
   * @description
   * 1. 정기 계측 명령을 요청
   * 2. 정기 계측 명령을 중복하여 요청(무시되야 함)
   * 3. 정기 계측 명령 처리 시 O.C에는 영향을 미치지 않음
   * 4. 명령 완료하였을 경우 명령 열에서 삭제 처리
   */
  it('Duplicate Measurement Command', async () => {
    // * 1. 정기 계측 명령을 요청
    // return;
    const isSuccess = control.inquiryAllDeviceStatus();
    expect(isSuccess).to.true;

    // * 2. 정기 계측 명령을 중복하여 요청(무시되야 함)
    expect(() => control.inquiryAllDeviceStatus()).to.throw(Error);

    // // * 3. 정기 계측 명령 처리 시 O.C에는 영향을 미치지 않음
    const ocLength = control.model.findExistOverlapControl();
    expect(ocLength.length).to.eq(0);

    // BU.CLI(ocLength);

    // * 4. 명령 완료하였을 경우 명령 열에서 삭제 처리
    let measureCmdList = _.filter(control.model.complexCmdList, {
      wrapCmdType: reqWrapCmdType.MEASURE,
    });
    expect(measureCmdList.length).to.eq(1);

    // BU.CLI('@@@@@@@@@@@@@');

    await eventToPromise(control, 'completeInquiryAllDeviceStatus');

    measureCmdList = _.filter(control.model.complexCmdList, {
      wrapCmdType: reqWrapCmdType.MEASURE,
    });
    expect(measureCmdList.length).to.eq(0);
  });

  /**
   * @desc T.C 1 [수동 모드]
   * @description
   * 1. 수문 5번을 연다.
   * 2. 펌프 1번을 킨다.
   * 3. 밸브 2번을 킨다.
   * 4. 동작 중에 1~2번을 한번 더 시도한다.(명령이 등록되지 않아야한다.)
   * 5. 명령 완료 순서는 펌프 > 수문 > 밸브
   * 6. 명령 완료하였을 경우 O.C reservedExecUU는 삭제처리 되어야 한다.
   */
  it('setDeviceForDB', async () => {
    expect(control.nodeList.length).to.not.eq(0);

    /** @type {reqCmdEleInfo} 1. 수문 5번을 연다. */
    const openGateCmd = {
      nodeId: 'WD_005',
      singleControlType: requestDeviceControlType.TRUE,
    };

    /** @type {reqCmdEleInfo} 2. 펌프 1번을 킨다. */
    const openPumpCmd = {
      nodeId: 'P_001',
      singleControlType: requestDeviceControlType.TRUE,
    };

    /** @type {reqCmdEleInfo} 3. 밸브 2번을 킨다. */
    const openValveCmd = {
      nodeId: 'V_002',
      singleControlType: requestDeviceControlType.TRUE,
    };

    // 장치들 명령 요청
    const openGateWC = control.executeSingleControl(openGateCmd);
    const onPumpWC = control.executeSingleControl(openPumpCmd);
    const openValveWC = control.executeSingleControl(openValveCmd);

    // * 3. 동작 중에 1~2번을 한번 더 시도한다.(명령이 등록되지 않아야한다.)
    expect(() => control.executeSingleControl(openGateCmd)).to.throw(Error);
    expect(() => control.executeSingleControl(openPumpCmd)).to.throw(Error);
    expect(() => control.executeSingleControl(openValveCmd)).to.throw(Error);

    // 명령 완료 순서는 DPC 각 장치별 제어에 따른 status 지연 명령 시간에 따라 결정
    // 명령 실행 순서: 수문 > 펌프 > 밸브
    // 명령 완료 순서: 펌프 > 수문 > 밸브
    const firstCompleteWCU = await eventToPromise(control, 'completeCommand');

    // * 4. 명령 완료하였을 경우 O.C reservedExecUU는 삭제처리 되어야 한다.
    // 첫번째 명령 완료: 펌프 >> O.C reservedExecUU는 삭제
    expect(control.model.findOverlapControlNode(openPumpCmd).reservedExecUU).to.eq('');
    // 첫번째 명령 완료: 수문은 >> O.C reservedExecUU는 유지
    expect(control.model.findOverlapControlNode(openGateCmd).reservedExecUU).to.not.eq('');

    const secondCompleteWCU = await eventToPromise(control, 'completeCommand');

    // 첫번째 명령 완료: 수문은 >> O.C reservedExecUU는 유지
    expect(control.model.findOverlapControlNode(openGateCmd).reservedExecUU).to.eq('');

    const thirdCompleteWCU = await eventToPromise(control, 'completeCommand');

    const { wrapCmdUUID: wdWCU } = openGateWC;
    const { wrapCmdUUID: pumpWCU } = onPumpWC;
    const { wrapCmdUUID: valveWCU } = openValveWC;

    // 5. 명령 완료 순서는 펌프 > 수문 > 밸브
    expect(firstCompleteWCU).to.eq(pumpWCU);
    expect(secondCompleteWCU).to.eq(wdWCU);
    expect(thirdCompleteWCU).to.eq(valveWCU);

    // BU.CLIN(control.nodeList);
  });

  // it('bindingPlaceList', async () => {});
});

// const Converter = require('device-protocol-converter-jh');

process.on('uncaughtException', err => {
  // BU.debugConsole();
  console.error(err.stack);
  console.log(err.message);
  console.log('Node NOT Exiting...');
});

process.on('unhandledRejection', err => {
  // BU.debugConsole();
  BU.CLI(err);
  console.log('Node NOT Exiting...');
});
