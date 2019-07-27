require('dotenv').config();
const _ = require('lodash');
const Promise = require('bluebird');
const { expect } = require('chai');

const eventToPromise = require('event-to-promise');

const { BU } = require('base-util-jh');
const config = require('./config');
const Main = require('../../../src/Main');
const CoreFacade = require('../../../src/core/CoreFacade');

const MuanControl = require('../../../src/projects/UPSAS/muan/MuanControl');

const ThreCmdComponent = require('../../../src/core/CommandManager/Command/ThresholdCommand/ThreCmdComponent');

const { goalDataRange } = ThreCmdComponent;

const { dcmConfigModel } = CoreFacade;

const {
  complexCmdStep,
  commandEvent: cmdEvent,
  commandStep: cmdStep,
  nodePickKey,
  complexCmdPickKey,
  nodeDataType,
  reqWrapCmdType: reqWCT,
  reqWrapCmdFormat: reqWCF,
  reqDeviceControlType: { TRUE, FALSE, SET, MEASURE },
} = dcmConfigModel;

process.env.NODE_ENV = 'development';

const { dbInfo } = config;

const main = new Main();
// const control = main.createControl({
//   dbInfo: config.dbInfo,
// });
const control = main.createControl(config);
const coreFacade = new CoreFacade();
// const control = new MuanControl(config);

describe('Manual Mode', function() {
  this.timeout(5000);
  before(async () => {
    await control.init(dbInfo, config.uuid);
    control.runFeature();
  });

  beforeEach(async () => {
    try {
      coreFacade.changeCmdStrategy(coreFacade.cmdStrategyType.MANUAL);

      // control.executeSetControl({
      //   wrapCmdId: 'closeAllDevice',
      //   wrapCmdType: reqWCT.CONTROL,
      // });
      // await eventToPromise(control, 'completeCommand');
    } catch (error) {
      BU.error(error.message);
    }
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
    const {
      cmdManager,
      cmdManager: { cmdOverlapManager },
    } = control.model;
    // * 1. 정기 계측 명령을 요청
    // return;
    const cmdStorage = control.inquiryAllDeviceStatus();
    expect(cmdStorage.wrapCmdFormat).to.eq(reqWCF.MEASURE);

    // * 2. 정기 계측 명령을 중복하여 요청(무시되야 함)
    expect(() => control.inquiryAllDeviceStatus()).to.throw(Error);

    // // * 3. 정기 계측 명령 처리 시 O.C에는 영향을 미치지 않음
    const ocLength = cmdOverlapManager.getExistOverlapStatusList();
    expect(ocLength.length).to.eq(0);

    // BU.CLI(ocLength);

    // * 4. 명령 완료하였을 경우 명령 열에서 삭제 처리
    expect(cmdManager.getCmdStorageList({ wrapCmdFormat: reqWCF.MEASURE })).to.length(1);

    await eventToPromise(control, cmdStep.END);

    // 정기 계측 명령 완료 했으므로
    expect(cmdManager.getCmdStorageList({ wrapCmdFormat: reqWCF.MEASURE })).to.length(0);
  });

  /**
   * @desc T.C 2 [수동 모드]
   * @description
   * 1. 수문 5번을 연다.
   * 2. 펌프 1번을 킨다.
   * 3. 밸브 2번을 킨다.
   * 4. 동작 중에 1~2번을 한번 더 시도한다.(명령이 등록되지 않아야한다.)
   * 5. 명령 완료 순서는 펌프 > 수문 > 밸브
   */
  it('Single Command Flow', async () => {
    const {
      cmdManager,
      cmdManager: { cmdOverlapManager },
    } = control.model;

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

    // * 4. 동작 중에 1~2번을 한번 더 시도한다.(명령이 등록되지 않아야한다.)
    expect(() => control.executeSingleControl(openGateCmd)).to.throw(Error);
    expect(() => control.executeSingleControl(openPumpCmd)).to.throw(Error);
    expect(() => control.executeSingleControl(openValveCmd)).to.throw(Error);

    // 명령 완료 순서는 DPC 각 장치별 제어에 따른 status 지연 명령 시간에 따라 결정
    // 명령 실행 순서: 수문 > 펌프 > 밸브
    // 명령 완료 순서: 펌프 > 수문 > 밸브

    const firstCompleteWC = await eventToPromise(control, cmdStep.END);

    expect(onPumpWC.wrapCmdId).to.eq(firstCompleteWC.wrapCmdId);

    expect(cmdManager.getCmdStorageList()).to.length(2);

    expect(
      cmdOverlapManager
        .getOverlapStatus(openPumpCmd.nodeId, openPumpCmd.singleControlType)
        .getReservedECU(),
    ).to.eq('');

    const secondCompleteWC = await eventToPromise(control, cmdStep.END);
    expect(cmdManager.getCmdStorageList()).to.length(1);

    const thirdCompleteWC = await eventToPromise(control, cmdStep.END);
    expect(cmdManager.getCmdStorageList()).to.length(0);

    // 5. 명령 완료 순서는 펌프 > 수문 > 밸브
    expect(firstCompleteWC).to.deep.eq(onPumpWC);
    expect(secondCompleteWC).to.deep.eq(openGateWC);
    expect(thirdCompleteWC).to.deep.eq(openValveWC);

    // BU.CLIN(control.nodeList);
  });

  /**
   * @desc T.C 3 [수동 모드]
   * @description
   */
  // it('bindingPlaceList', async () => {});
});

describe('Automatic Mode', function() {
  this.timeout(5000);

  /** @type {reqFlowCmdInfo} 저수지 > 증발지 1-A */
  const rvToSEB1A = {
    srcPlaceId: 'RV',
    destPlaceId: 'SEB_1_A',
    wrapCmdType: reqWCT.CONTROL,
  };

  /** @type {reqFlowCmdInfo} 저수지 > 증발지 1-B */
  const rvToSEB1B = {
    srcPlaceId: 'RV',
    destPlaceId: 'SEB_1_B',
    wrapCmdType: reqWCT.CONTROL,
  };

  /** @type {reqFlowCmdInfo} 증발지 1-A > 해주 1 */
  const SEB1AToBW1 = {
    srcPlaceId: 'SEB_1_A',
    destPlaceId: 'BW_1',
    wrapCmdType: reqWCT.CONTROL,
  };

  before(async () => {
    await control.init(dbInfo, config.uuid);
    control.runFeature();

    control.inquiryAllDeviceStatus();
    await eventToPromise(control, 'completeInquiryAllDeviceStatus');
  });

  beforeEach(async () => {
    try {
      coreFacade.changeCmdStrategy(coreFacade.cmdStrategyType.MANUAL);
      control.executeSetControl({
        wrapCmdId: 'closeAllDevice',
        wrapCmdType: reqWCT.CONTROL,
      });
      await eventToPromise(control, 'completeCommand');
    } catch (error) {
      BU.error(error.message);
    }

    coreFacade.changeCmdStrategy(coreFacade.cmdStrategyType.OVERLAP_COUNT);
  });

  /**
   * @desc T.C 1 [자동 모드]
   * 다중 흐름 명령을 요청하고 이에 반하는 흐름 명령을 요청하여 충돌 체크가 제대로 동작하는지 확인
   * @description
   * 1. 저수지 > 증발지 1-A 명령 요청.
   * trueNodeList: ['V_006', 'V_001', 'P_002'],
   * falseNodeList: ['GV_001'],
   * 2. 저수지 > 증발지 1-B 명령 요청. 명령 충돌 발생 X
   * trueNodeList: ['V_006', 'V_002', 'P_002'],
   * falseNodeList: ['GV_002'],
   * 3. 증발지 1-A > 해주 1 명령 요청. 명령 충돌 발생 O
   * trueNodeList: ['GV_001', 'WD_013', 'WD_010'],
   * falseNodeList: ['WD_016'],
   * 4. 증발지 1-A > 해주 1 명령 취소. 존재하지 않으므로 X
   * 5. 저수지 > 증발지 1-A 명령 취소.
   * 'V_001' 닫힘. 'GV_001' OC 해제
   * 6. 증발지 1-A > 해주 1 명령 요청. 명령 충돌 발생 X
   * 7. 저수지 > 증발지 1-B 명령 취소.
   * 'P_002', 'V_002', 'V_006' 순으로 닫힘. OC 해제
   * 8. 증발지 1-A > 해주 1 명령 취소.
   * OC는 전부 해제, 존재 명령 X, 모든 장치는 닫힘
   */
  it.only('Multi Flow Command Control & Conflict & Cancel', async () => {
    const { cmdOverlapManager } = control.model.cmdManager;
    // BU.CLI('Multi Flow Command Control & Conflict & Cancel');
    // 1. 저수지 > 증발지 1-A 명령 요청. 펌프 2, 밸브 6, 밸브 1 . 실제 제어 true 확인 및 overlap 확인
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

    // BU.CLI(_(existOverlapList).map('overlapStatusList').flatten().value())

    // True O.C 는 3개, trueList: ['V_006', 'V_001', 'P_002'],
    expect(cmdOverlapManager.getExistSimpleOverlapList(TRUE)).to.length(3);
    // False O.C 는 1개, trueList: ['GV_001'],
    expect(cmdOverlapManager.getExistSimpleOverlapList(FALSE)).to.length(1);

    // expect(realFalseCmdRvTo1A.).

    // * 2. 저수지 > 증발지 1-B 명령 요청. 실제 제어 추가 확인 V_002
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

    // True O.C 는 4개, trueList: ['V_006', 'V_001', 'V_002', 'P_002'],
    expect(cmdOverlapManager.getExistSimpleOverlapList(TRUE)).to.length(4);
    // False O.C 는 2개, trueList: ['GV_001', 'GV_002'],
    expect(cmdOverlapManager.getExistSimpleOverlapList(FALSE)).to.length(2);

    // 저수지 > 증발지 1-A 명령 완료.
    const firstCompleteWCU = await eventToPromise(control, 'completeCommand');
    // expect(cmdRvTo1A.wrapCmdUUID).to.eq(firstCompleteWCU);

    // 저수지 > 증발지 1-B 명령 완료.
    const secondCompleteWCU = await eventToPromise(control, 'completeCommand');
    // expect(cmdRvTo1B.wrapCmdUUID).to.eq(secondCompleteWCU);

    // 현재 실행중인 명령은 2개
    expect(control.model.complexCmdList).to.length(2);

    // * 3. 증발지 1-A > 해주 1 명령 요청. GV_001 명령 충돌 발생 O
    // * trueNodeList: ['GV_001', 'WD_013', 'WD_010'],
    // * falseNodeList: ['WD_016'],
    // BU.CLI(control.executeFlowControl(SEB1AToBW1))
    expect(() => control.executeFlowControl(SEB1AToBW1)).to.throw(
      `Conflict of WCI(SEB_1_A_TO_BW_1) SingleControlType(${TRUE}) of node(GV_001)`,
    );

    // * 4. 증발지 1-A > 해주 1 명령 요청. 존재하지 않으므로 X
    SEB1AToBW1.wrapCmdType = reqWCT.CANCEL;
    expect(() => control.executeFlowControl(SEB1AToBW1)).to.throw(
      'The command(SEB_1_A_TO_BW_1) does not exist and you can not issue a CANCEL command.',
    );

    // * 5. 저수지 > 증발지 1-A 명령 취소.
    rvToSEB1A.wrapCmdType = reqWCT.CANCEL;
    const cancelCmdRvTo1A = control.executeFlowControl(rvToSEB1A);

    // 실제 True 장치 목록
    realTrueCmd = _.find(cancelCmdRvTo1A.realContainerCmdList, {
      singleControlType: TRUE,
    });
    //  실제 False 장치 목록
    realFalseCmd = _.find(cancelCmdRvTo1A.realContainerCmdList, {
      singleControlType: FALSE,
    });

    // 실제 True 장치는 없어야 한다. 명령 취소를 한 것이기 때문
    expect(_.isEmpty(realTrueCmd)).to.true;

    const realFalseNodes = _.map(realFalseCmd.eleCmdList, 'nodeId');

    // 실제 닫는 장치는 아래와 같아야 한다.
    expect(realFalseNodes).to.deep.equal(['V_001']);

    // True O.C 는 3개, trueList: ['V_006', 'V_002', 'P_002'],
    expect(cmdOverlapManager.getExistSimpleOverlapList(TRUE)).to.length(3);

    // False O.C 는 1개, trueList: ['GV_002'],
    expect(cmdOverlapManager.getExistSimpleOverlapList(FALSE)).to.length(1);

    await eventToPromise(control, 'completeCommand');

    // * 6. 증발지 1-A > 해주 1 명령 요청. 명령 충돌 발생 X
    SEB1AToBW1.wrapCmdType = reqWCT.CONTROL;
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

    // True O.C 는 6개, trueList: ['V_006', 'V_002', 'P_002', 'GV_001', 'WD_010', 'WD_013'],
    expect(cmdOverlapManager.getExistSimpleOverlapList(TRUE)).to.length(6);
    // False O.C 는 2개, trueList: ['GV_002', 'WD_016'],
    expect(cmdOverlapManager.getExistSimpleOverlapList(FALSE)).to.length(2);

    await eventToPromise(control, 'completeCommand');

    // * 7. 저수지 > 증발지 1-B 명령 취소.
    // * 'P_002', 'V_002', 'V_006' 순으로 닫힘. OC 해제
    rvToSEB1B.wrapCmdType = reqWCT.CANCEL;
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

    // True O.C 는 3개, trueList: ['GV_001', 'WD_010', 'WD_013'],
    expect(cmdOverlapManager.getExistSimpleOverlapList(TRUE)).to.length(3);

    // False O.C 는 1개, trueList: ['WD_016'],
    expect(cmdOverlapManager.getExistSimpleOverlapList(FALSE)).to.length(1);

    await eventToPromise(control, 'completeCommand');

    // * 8. 증발지 1-A > 해주 1 명령 취소.
    // * OC는 전부 해제, 존재 명령 X, 모든 장치는 닫힘
    SEB1AToBW1.wrapCmdType = reqWCT.CANCEL;
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
    expect(cmdOverlapManager.getExistOverlapStatusList()).to.length(0);

    expect(control.model.complexCmdList).to.length(0);
  });

  /**
   * @desc T.C 2 [자동 모드]
   * 달성 목표가 있는 명령은 목표가 완료되었을 때 명령 스택에서 사라져야 한다.
   * @description
   * 1. 저수지 > 증발지 1-A 명령 요청. 달성 목표: 수위 10cm. 수위 조작 후 명령 삭제 확인.
   * 2. 저수지 > 증발지 1-A 명령 요청. 달성 제한 시간: 2 Sec. 시간 초과 후 명령 삭제 확인.
   * 3. 저수지 > 증발지 1-A 명령 요청. 달성 목표: 수위 10cm. 제한시간: 2 Sec. 수위 조작 후 타이머 Clear 처리 및 명령 삭제 확인.
   */
  it('Threshold Command ', async () => {
    const { cmdOverlapManager, threCmdManager } = control.model.cmdManager;
    // BU.CLI('Critical Command');
    const NODE_WL_001 = 'WL_001';
    const nodeInfo = _.find(control.nodeList, { node_id: NODE_WL_001 });
    // 최초 수위는 3으로 설정
    nodeInfo.data = 3;

    // * 1. 저수지 > 증발지 1-A 명령 요청. 달성 목표: 수위 10cm. 수위 조작 후 명령 삭제 확인.
    rvToSEB1A.wrapCmdType = reqWCT.CONTROL;
    rvToSEB1A.wrapCmdGoalInfo = {
      goalDataList: [
        {
          goalValue: 10,
          goalRange: goalDataRange.UPPER,
          nodeId: NODE_WL_001,
        },
      ],
    };

    /**
     * wc : Wrap Command
     * tcm: Threshold Command Manager
     * tcs: Threshold Command Storage
     * tcg: Threshold Command Goal
     * nu: Node Updator
     */

    // 저수지 > 증발지 1-A 명령 요청
    let wcRvTo1A = control.executeFlowControl(rvToSEB1A);
    // 명령이 완료되기를 기다림
    await eventToPromise(control, 'completeCommand');
    console.time('Step 1');

    // 저수지 > 증발지 1-A 임계치 저장소 가져옴
    let tcsRvTo1A = threCmdManager.getThreCmdStorage(wcRvTo1A);
    // BU.CLIN(tcsRvTo1A)
    let tcgGoalRvTo1A = tcsRvTo1A.getThreCmdGoal(NODE_WL_001);
    // 새로운 임계치 명령이 등록되야함.
    expect(tcsRvTo1A.threCmdGoalList).length(1);
    expect(tcgGoalRvTo1A.threCmdGoalId).to.eq(NODE_WL_001);
    // Node Id BT_001 에는 옵저버가 1개 등록되어야 한다.
    const nuBT001 = control.nodeUpdatorManager.getNodeUpdator(NODE_WL_001);

    expect(nuBT001.getObserver(tcgGoalRvTo1A)).to.equal(tcgGoalRvTo1A);

    // BT_011 를 가져오고 값을 설정한 후 데이터 갱신 이벤트를 발생 시킴
    nodeInfo.data = 11;
    control.notifyDeviceData(null, [nodeInfo]);

    // 임계치 명령 삭제
    tcsRvTo1A = threCmdManager.getThreCmdStorage(wcRvTo1A);
    // 삭제가 되었기 때문에 저장소는 삭제가 되어 임계치 관리 객체를 가져올 수 없음
    expect(tcsRvTo1A).to.undefined;

    // BU.CLIN(nuBT001, 1);

    // Node Id BT_001 에는 해당 옵저버가 없어야한다.
    expect(nuBT001.getObserver(tcgGoalRvTo1A)).to.undefined;

    // 임계치에 도달했기 때문에 CANCEL 명령 발송됨. 명령이 완료되기를 기다림
    await eventToPromise(control, 'completeCommand');
    console.timeEnd('Step 1');

    expect(control.model.complexCmdList).to.length(0);

    console.time('Step 2');

    // * 2. 저수지 > 증발지 1-A 명령 요청. 달성 제한 시간: 2 Sec. 시간 초과 후 명령 삭제 확인.
    rvToSEB1A.wrapCmdGoalInfo = {
      limitTimeSec: 1,
      goalDataList: [
        {
          goalValue: 10,
          goalRange: goalDataRange.UPPER,
          nodeId: NODE_WL_001,
        },
      ],
    };

    wcRvTo1A = control.executeFlowControl(rvToSEB1A);

    // 제어 명령이 완료되기를 기다림
    await eventToPromise(control, 'completeCommand');

    tcsRvTo1A = threCmdManager.getThreCmdStorage(wcRvTo1A);
    tcgGoalRvTo1A = tcsRvTo1A.getThreCmdGoal(NODE_WL_001);

    // 새로운 임계치 명령이 등록되야함.
    expect(tcsRvTo1A.threCmdGoals).length(1);

    // 딜레이 타이머만큼 기다림.
    await Promise.delay(2000);

    // 제한 시간 초과로 인한 임계치 명령 삭제
    tcsRvTo1A = threCmdManager.getThreCmdStorage(wcRvTo1A);

    // 삭제가 되었기 때문에 저장소는 삭제가 되어 임계치 관리 객체를 가져올 수 없음
    expect(tcsRvTo1A).to.undefined;

    // Node Id BT_001 에는 해당 옵저버가 없어야한다.
    expect(nuBT001.getObserver(tcgGoalRvTo1A)).to.undefined;

    // 현재 진행 중인 명령은 존재하지 않음
    expect(control.model.complexCmdList).to.length(0);

    // 현재 누적 OC는 존재하지 않음
    expect(cmdOverlapManager.getExistOverlapStatusList()).to.length(0);
    console.timeEnd('Step 2');
  });

  /**
   * @desc T.C 3 [자동 모드]
   * 해주 및 증발지의 면적에 따른 해수 부피를 산정하여 명령 수행 가능성 여부를 결정한다.
   * @description
   * 1. Map에 설정되어 있는 모든 장소의 임계치를 등록하고 초기화 한다.
   * 2. 수위: 5cm, 염도: (수중 증발지: 3도, 일반 증발지 4: 10도), 모듈 온도: 30도, 해주 및 저수지 수위: 1m로 설정한다.
   * 3. 해주 1 수위를 하한선(10cm)으로 설정. [해주 1 > 증발지 1-A] 명령 요청. 실패 X
   * 4. 해주 2 수위를 상한선(100cm)으로 설정. [증발지 1-A > 해주 2 ] 명령 요청. 실패 X
   * 5. 해주 1 수위를 적정선(70cm)으로 설정. [해주 1 > 증발지 1-A] 명령 요청. 성공 O
   * 6. 해주 2 수위를 하한선(10cm)으로 설정. [증발지 1-A > 해주 2] 명령 요청. 성공 O
   */

  /**
   * @desc T.C 4 [자동 모드]
   * 장소 임계치 동작을 검증한다.
   * @description
   * 1. Map에 설정되어 있는 모든 장소 임계치를 등록하고 초기화 한다.
   * 2. 수위: 5cm, 염도: (수중 증발지: 3도, 일반 증발지 4: 10도), 모듈 온도: 30도, 해주 및 저수지 수위: 1m로 설정한다.
   * 3. 1초 대기 후 WL_001의 수위를 하한 수위 1cm로 조작한다. 장소 임계치 설정에 의한 [저수지 > 증발지 1-A] 명령 요청
   * 4. 1초 대기 후 WL_002의 수위를 상한 수위 11cm로 조작한다. 장소 임계치 설정에 의한 [증발지 1-B > 해주 1] 명령 요청
   * 5. 1초 대기 후
   * 5. 1초 대기 후 MRT_003의 온도를 50도로 올리고
   * 5. 1초 대기 후 WL_001의 수위를 상한 수위 7cm로 조작한다. 임계치 명령 달성 조건 충족으로 [저수지 > 증발지 1-A] 명령 취소
   * 6. 1초 대기 후 WL_002의 수위를 적정 수위 5cm로 조작한다. 임계치 명령 달성 조건 충족으로 [증발지 1-B > 해주 1] 명령 취소
   */
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
