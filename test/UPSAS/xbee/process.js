require('dotenv').config();
const _ = require('lodash');
const { expect } = require('chai');

const eventToPromise = require('event-to-promise');

const { BU } = require('base-util-jh');
const config = require('./config');
const Main = require('../../../src/Main');

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

const main = new Main();
// const control = main.createControl({
//   dbInfo: config.dbInfo,
// });
const control = main.createControl(config);

describe('Manual Mode', () => {
  before(async () => {
    await control.init(dbInfo, config.uuid);
    control.runFeature();
    control.controlMode = controlModeInfo.MANUAL;
  });

  /**
   * @desc T.C 1 [수동 모드]
   * @description
   * 1. 정기 계측 명령을 요청
   * 2. 정기 계측 명령을 중복하여 요청(무시되야 함)
   * 3. 정기 계측 명령 처리 시 O.C에는 영향을 미치지 않음
   * 4. 명령 완료하였을 경우 명령 열에서 삭제 처리
   */
  it.only('Duplicate Measurement Command', async () => {
    // * 1. 정기 계측 명령을 요청
    let isSuccess = control.inquiryAllDeviceStatus();
    expect(isSuccess).to.true;

    // * 2. 정기 계측 명령을 중복하여 요청(무시되야 함)
    isSuccess = control.inquiryAllDeviceStatus();
    expect(isSuccess).to.false;

    // * 3. 정기 계측 명령 처리 시 O.C에는 영향을 미치지 않음
    const ocLength = control.model.findExistOverlapControl();
    expect(ocLength.length).to.eq(0);

    // * 4. 명령 완료하였을 경우 명령 열에서 삭제 처리
    let measureCmdList = _.filter(control.model.complexCmdList, {
      wrapCmdType: reqWrapCmdType.MEASURE,
    });
    expect(measureCmdList.length).to.eq(1);

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
   * 3. 동작 중에 1~2번을 한번 더 시도한다.(명령이 등록되지 않아야한다.)
   * 4. 명령 완료하였을 경우 O.C reservedExecUU는 삭제처리 되어야 한다.
   */
  it('setDeviceForDB', async () => {
    expect(control.nodeList.length).to.not.eq(0);

    // * 1. 수문 5번을 연다.
    control.executeSingleControl({
      nodeId: 'WD_005',
      singleControlType: requestDeviceControlType.TRUE,
    });

    // * 2. 펌프 1번을 킨다.
    control.executeSingleControl({
      nodeId: 'P_001',
      singleControlType: requestDeviceControlType.TRUE,
    });

    // * 3. 동작 중에 1~2번을 한번 더 시도한다.(명령이 등록되지 않아야한다.)
    control.executeSingleControl({
      nodeId: 'WD_005',
      singleControlType: requestDeviceControlType.TRUE,
    });

    control.executeSingleControl({
      nodeId: 'P_001',
      singleControlType: requestDeviceControlType.TRUE,
    });

    // 명령이 완료되길 기다린다.
    const completeWaterDoor = await eventToPromise(control, 'completeCommand');

    BU.CLIN(control.nodeList);
  });

  it('bindingPlaceList', async () => {});
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
