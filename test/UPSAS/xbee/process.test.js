require('dotenv').config();
const _ = require('lodash');
const Promise = require('bluebird');
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
  reqDeviceControlType: { TRUE, FALSE, SET, MEASURE },
} = dcmConfigModel;

process.env.NODE_ENV = 'development';

const { dbInfo } = config;

const main = new Main();
// const control = main.createControl({
//   dbInfo: config.dbInfo,
// });
const control = main.createControl(config);
// const control = new MuanControl(config);

describe.skip('Manual Mode', function() {
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
   * 2. 정기 계측 명령을 중복하여 요청(예외 발생:무시되야 함)
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
   * @desc T.C 2 [수동 모드]
   * @description
   * 1. 수문 5번을 연다.
   * 2. 펌프 1번을 킨다.
   * 3. 밸브 2번을 킨다.
   * 4. 동작 중에 1~2번을 한번 더 시도한다.(명령이 등록되지 않아야한다.)
   * 5. 명령 완료 순서는 펌프 > 수문 > 밸브
   * 6. 명령 완료하였을 경우 O.C reservedExecUU는 삭제처리 되어야 한다.
   */
  it('Single Command Flow', async () => {
    // 제어 중인 장치가 있을 경우 Close 명령
    control.executeSetControl({
      wrapCmdId: 'closeAllDevice',
      wrapCmdType: reqWrapCmdType.CONTROL,
    });
    // 모든 장치 Close 명령이 완료 되길 기다림
    await eventToPromise(control, 'completeCommand');

    /** @type {reqCmdEleInfo} 1. 수문 5번을 연다. */
    const openGateCmd = {
      nodeId: 'WD_005',
      singleControlType: TRUE,
    };

    /** @type {reqCmdEleInfo} 2. 펌프 1번을 킨다. */
    const openPumpCmd = {
      nodeId: 'P_001',
      singleControlType: TRUE,
    };

    /** @type {reqCmdEleInfo} 3. 밸브 2번을 킨다. */
    const openValveCmd = {
      nodeId: 'V_002',
      singleControlType: TRUE,
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
    expect(control.model.cmdManager.findOverlapControlNode(openPumpCmd).reservedExecUU).to.eq('');
    // 첫번째 명령 완료: 수문은 >> O.C reservedExecUU는 유지
    expect(control.model.cmdManager.findOverlapControlNode(openGateCmd).reservedExecUU).to.not.eq(
      '',
    );

    const secondCompleteWCU = await eventToPromise(control, 'completeCommand');

    // 첫번째 명령 완료: 수문은 >> O.C reservedExecUU는 유지
    expect(control.model.cmdManager.findOverlapControlNode(openGateCmd).reservedExecUU).to.eq('');

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

  /**
   * @desc T.C 3 [수동 모드]
   * @description
   */
  // it('bindingPlaceList', async () => {});
});

describe('Automatic Mode', function() {
  this.timeout(10000);

  /** @type {reqFlowCmdInfo} 저수조 > 증발지 1-A */
  const rvToSEB1A = {
    srcPlaceId: 'RV',
    destPlaceId: 'SEB_1_A',
    wrapCmdType: reqWrapCmdType.CONTROL,
  };

  /** @type {reqFlowCmdInfo} 저수조 > 증발지 1-B */
  const rvToSEB1B = {
    srcPlaceId: 'RV',
    destPlaceId: 'SEB_1_B',
    wrapCmdType: reqWrapCmdType.CONTROL,
  };

  /** @type {reqFlowCmdInfo} 증발지 1-A > 해주 1 */
  const SEB1AToBW1 = {
    srcPlaceId: 'SEB_1_A',
    destPlaceId: 'BW_1',
    wrapCmdType: reqWrapCmdType.CONTROL,
  };

  before(async () => {
    await control.init(dbInfo, config.uuid);
    control.runFeature();
    // 설정 명령이  O.C 스택에 올라가지 않도록 하기 위함
    control.controlMode = controlModeInfo.MANUAL;

    control.executeSetControl({
      wrapCmdId: 'closeAllDevice',
      wrapCmdType: reqWrapCmdType.CONTROL,
    });
    // BU.CLI(control.model.complexCmdList);
  });

  /**
   * @desc T.C 1 [자동 모드]
   * 다중 흐름 명령을 요청하고 이에 반하는 흐름 명령을 요청하여 충돌 체크가 제대로 동작하는지 확인
   * @description
   * 1. 저수조 > 증발지 1-A 명령 요청.
   * trueNodeList: ['V_006', 'V_001', 'P_002'],
   * falseNodeList: ['GV_001'],
   * 2. 저수조 > 증발지 1-B 명령 요청. 명령 충돌 발생 X
   * trueNodeList: ['V_006', 'V_002', 'P_002'],
   * falseNodeList: ['GV_002'],
   * 3. 증발지 1-A > 해주 1 명령 요청. 명령 충돌 발생 O
   * trueNodeList: ['GV_001', 'WD_013', 'WD_010'],
   * falseNodeList: ['WD_016'],
   * 4. 증발지 1-A > 해주 1 명령 취소. 존재하지 않으므로 X
   * 5. 저수조 > 증발지 1-A 명령 취소.
   * 'V_001' 닫힘. 'GV_001' OC 해제
   * 6. 증발지 1-A > 해주 1 명령 요청. 명령 충돌 발생 X
   * 7. 저수조 > 증발지 1-B 명령 취소.
   * 'P_002', 'V_002', 'V_006' 순으로 닫힘. OC 해제
   * 8. 증발지 1-A > 해주 1 명령 취소.
   * OC는 전부 해제, 존재 명령 X, 모든 장치는 닫힘
   */
  it.skip('Multi Flow Command Control & Conflict & Cancel ', async () => {
    // 모든 장치 Close 명령이 완료 되길 기다림
    await eventToPromise(control, 'completeCommand');
    // 설정 모드를 Automatic 으로 교체
    control.changeControlMode(controlModeInfo.AUTOMATIC);

    // 1. 저수조 > 증발지 1-A 명령 요청. 펌프 2, 밸브 6, 밸브 1 . 실제 제어 true 확인 및 overlap 확인
    const cmdRvTo1A = control.executeFlowControl(rvToSEB1A);

    // 실제 True 장치 목록
    let realTrueCmd = _.find(cmdRvTo1A.realContainerCmdList, {
      singleControlType: TRUE,
    });
    //  실제 False 장치 목록
    let realFalseCmd = _.find(cmdRvTo1A.realContainerCmdList, {
      singleControlType: FALSE,
    });

    // 실제 False 장치는 없어야 한다. 기존 상태가 모두 False 이기 때문
    expect(_.isEmpty(realFalseCmd)).to.true;

    let realTrueNodes = _.map(realTrueCmd.eleCmdList, 'nodeId');

    // 실제 여는 장치는 아래와 같아야 한다.
    expect(realTrueNodes).to.deep.equal(['V_006', 'V_001', 'P_002']);

    let existOverlapList = control.model.cmdManager.findExistOverlapControl();

    // True O.C 는 3개, trueList: ['V_006', 'V_001', 'P_002'],
    expect(_.filter(existOverlapList, { singleControlType: TRUE })).to.length(3);
    // False O.C 는 1개, trueList: ['GV_001'],
    expect(_.filter(existOverlapList, { singleControlType: FALSE })).to.length(1);

    // expect(realFalseCmdRvTo1A.).

    // * 2. 저수조 > 증발지 1-B 명령 요청. 실제 제어 추가 확인 V_002
    // * trueList: ['V_006', 'V_002', 'P_002'],
    // * falseList: ['GV_002'],
    // await Promise.delay(100);
    const cmdRvTo1B = control.executeFlowControl(rvToSEB1B);

    // 실제 True 장치 목록
    realTrueCmd = _.find(cmdRvTo1B.realContainerCmdList, {
      singleControlType: TRUE,
    });
    //  실제 False 장치 목록
    realFalseCmd = _.find(cmdRvTo1B.realContainerCmdList, {
      singleControlType: FALSE,
    });

    realTrueNodes = _.map(realTrueCmd.eleCmdList, 'nodeId');
    // 실제 여는 장치는 아래와 같아야 한다.
    expect(realTrueNodes).to.deep.equal(['V_002']);
    existOverlapList = control.model.cmdManager.findExistOverlapControl();

    // True O.C 는 4개, trueList: ['V_006', 'V_001', 'V_002', 'P_002'],
    expect(_.filter(existOverlapList, { singleControlType: TRUE })).to.length(4);
    // False O.C 는 2개, trueList: ['GV_001', 'GV_002'],
    expect(_.filter(existOverlapList, { singleControlType: FALSE })).to.length(2);

    // 저수조 > 증발지 1-A 명령 완료.
    const firstCompleteWCU = await eventToPromise(control, 'completeCommand');
    // expect(cmdRvTo1A.wrapCmdUUID).to.eq(firstCompleteWCU);

    // 저수조 > 증발지 1-B 명령 완료.
    const secondCompleteWCU = await eventToPromise(control, 'completeCommand');
    // expect(cmdRvTo1B.wrapCmdUUID).to.eq(secondCompleteWCU);

    // 현재 실행중인 명령은 2개
    expect(control.model.complexCmdList).to.length(2);

    // * 3. 증발지 1-A > 해주 1 명령 요청. GV_001 명령 충돌 발생 O
    // * trueNodeList: ['GV_001', 'WD_013', 'WD_010'],
    // * falseNodeList: ['WD_016'],
    expect(() => control.executeFlowControl(SEB1AToBW1)).to.throw(
      'A node(GV_001) in wrapCmd(SEB_1_A_TO_BW_1) has conflict.',
    );

    // * 4. 증발지 1-A > 해주 1 명령 요청. 존재하지 않으므로 X
    SEB1AToBW1.wrapCmdType = reqWrapCmdType.CANCEL;
    expect(() => control.executeFlowControl(SEB1AToBW1)).to.throw(
      'The command(SEB_1_A_TO_BW_1) does not exist and you can not issue a CANCEL command.',
    );

    // * 5. 저수조 > 증발지 1-A 명령 취소.
    rvToSEB1A.wrapCmdType = reqWrapCmdType.CANCEL;
    const cancelCmdRvTo1A = control.executeFlowControl(rvToSEB1A);

    // 실제 True 장치 목록
    realTrueCmd = _.find(cancelCmdRvTo1A.realContainerCmdList, {
      singleControlType: TRUE,
    });
    //  실제 False 장치 목록
    realFalseCmd = _.find(cancelCmdRvTo1A.realContainerCmdList, {
      singleControlType: FALSE,
    });

    // BU.CLI(realTrueCmd);
    // BU.CLI(realFalseCmd);
    // 실제 True 장치는 없어야 한다. 명령 취소를 한 것이기 때문
    expect(_.isEmpty(realTrueCmd)).to.true;

    const realFalseNodes = _.map(realFalseCmd.eleCmdList, 'nodeId');

    // 실제 닫는 장치는 아래와 같아야 한다.
    expect(realFalseNodes).to.deep.equal(['V_001']);

    // 실행 중인 OC 를 가져옴
    existOverlapList = control.model.cmdManager.findExistOverlapControl();

    // True O.C 는 3개, trueList: ['V_006', 'V_002', 'P_002'],
    expect(_.filter(existOverlapList, { singleControlType: TRUE })).to.length(3);

    // False O.C 는 1개, trueList: ['GV_002'],
    expect(_.filter(existOverlapList, { singleControlType: FALSE })).to.length(1);

    await eventToPromise(control, 'completeCommand');

    // * 6. 증발지 1-A > 해주 1 명령 요청. 명령 충돌 발생 X
    SEB1AToBW1.wrapCmdType = reqWrapCmdType.CONTROL;
    const cmdSEB1AToBW1 = control.executeFlowControl(SEB1AToBW1);

    // 실제 True 장치 목록
    realTrueCmd = _.find(cmdSEB1AToBW1.realContainerCmdList, {
      singleControlType: TRUE,
    });
    //  실제 False 장치 목록
    realFalseCmd = _.find(cmdSEB1AToBW1.realContainerCmdList, {
      singleControlType: FALSE,
    });

    // 실제 여는 장치는 아래와 같아야 한다.
    expect(_.map(realTrueCmd.eleCmdList, 'nodeId')).to.deep.equal(['GV_001', 'WD_013', 'WD_010']);

    existOverlapList = control.model.cmdManager.findExistOverlapControl();

    // True O.C 는 6개, trueList: ['V_006', 'V_002', 'P_002', 'GV_001', 'WD_010', 'WD_013'],
    expect(_.filter(existOverlapList, { singleControlType: TRUE })).to.length(6);
    // False O.C 는 2개, trueList: ['GV_002', 'WD_016'],
    expect(_.filter(existOverlapList, { singleControlType: FALSE })).to.length(2);

    await eventToPromise(control, 'completeCommand');

    // * 7. 저수조 > 증발지 1-B 명령 취소.
    // * 'P_002', 'V_002', 'V_006' 순으로 닫힘. OC 해제
    rvToSEB1B.wrapCmdType = reqWrapCmdType.CANCEL;
    const cancelCmdRvTo1B = control.executeFlowControl(rvToSEB1B);

    // 실제 True 장치 목록
    realTrueCmd = _.find(cancelCmdRvTo1B.realContainerCmdList, {
      singleControlType: TRUE,
    });
    //  실제 False 장치 목록
    realFalseCmd = _.find(cancelCmdRvTo1B.realContainerCmdList, {
      singleControlType: FALSE,
    });

    // 실제 True 장치는 없어야 한다. 명령 취소를 한 것이기 때문
    expect(_.isEmpty(realTrueCmd)).to.true;

    // 실제 닫는 장치는 아래와 같아야 한다.
    expect(_.map(realFalseCmd.eleCmdList, 'nodeId')).to.deep.equal(['P_002', 'V_002', 'V_006']);

    // 실행 중인 OC 를 가져옴
    existOverlapList = control.model.cmdManager.findExistOverlapControl();

    // True O.C 는 3개, trueList: ['GV_001', 'WD_010', 'WD_013'],
    expect(_.filter(existOverlapList, { singleControlType: TRUE })).to.length(3);

    // False O.C 는 1개, trueList: ['WD_016'],
    expect(_.filter(existOverlapList, { singleControlType: FALSE })).to.length(1);

    await eventToPromise(control, 'completeCommand');

    // * 8. 증발지 1-A > 해주 1 명령 취소.
    // * OC는 전부 해제, 존재 명령 X, 모든 장치는 닫힘
    SEB1AToBW1.wrapCmdType = reqWrapCmdType.CANCEL;
    const cancelCmdSEB1AToBW1 = control.executeFlowControl(SEB1AToBW1);

    // 실제 True 장치 목록
    realTrueCmd = _.find(cancelCmdSEB1AToBW1.realContainerCmdList, {
      singleControlType: TRUE,
    });
    //  실제 False 장치 목록
    realFalseCmd = _.find(cancelCmdSEB1AToBW1.realContainerCmdList, {
      singleControlType: FALSE,
    });

    // 실제 True 장치는 없어야 한다. 명령 취소를 한 것이기 때문
    expect(_.isEmpty(realTrueCmd)).to.true;

    // 실제 닫는 장치는 아래와 같아야 한다.
    expect(_.map(realFalseCmd.eleCmdList, 'nodeId')).to.deep.equal(['WD_010', 'WD_013', 'GV_001']);

    await eventToPromise(control, 'completeCommand');

    // 모든 명령은 수행되었고 O.C 는 존재하지 않음
    expect(control.model.cmdManager.findExistOverlapControl()).to.length(0);

    expect(control.model.complexCmdList).to.length(0);
  });

  /**
   * @desc T.C 2 [자동 모드]
   * @desc 이 TC는 Echo Server와 함께 수행해야 한다.
   * 달성 목표가 있는 명령은 목표가 완료되었을 때 명령 스택에서 사라져야 한다.
   * @description
   * 1. 저수조 > 증발지 1-A 명령 요청. 달성 목표: 수위 10cm [Echo]. 수위 조작 후 명령 삭제 확인.
   * 2. 저수조 > 증발지 1-A 명령 요청. 달성 제한 시간: 2 Sec. 시간 초과 후 명령 삭제 확인.
   * 3. 저수조 > 증발지 1-A 명령 요청. 달성 목표: 수위 10cm [Echo]. 제한시간: 2 Sec. 수위 조작 후 타이머 Clear 처리 및 명령 삭제 확인.
   */
  it('Critical Command ', async () => {
    // 모든 장치 Close 명령이 완료 되길 기다림
    await eventToPromise(control, 'completeCommand');
    // 설정 모드를 Automatic 으로 교체
    control.controlMode = controlModeInfo.AUTOMATIC;

    // * 1. 저수조 > 증발지 1-A 명령 요청. 달성 목표: 수위 10cm [Echo]. 수위 조작 후 명령 삭제 확인.
    // const cmdRvTo1A = control.executeFlowControl(rvToSEB1A);

    // * 2. 저수조 > 증발지 1-A 명령 요청. 달성 제한 시간: 2 Sec. 시간 초과 후 명령 삭제 확인.

    // * 3. 저수조 > 증발지 1-A 명령 요청. 달성 목표: 수위 10cm [Echo]. 제한시간: 2 Sec. 수위 조작 후 타이머 Clear 처리 및 명령 삭제 확인.
  });
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
