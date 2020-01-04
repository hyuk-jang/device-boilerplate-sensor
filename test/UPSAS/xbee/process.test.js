require('dotenv').config();
const _ = require('lodash');
const Promise = require('bluebird');
const { expect } = require('chai');

const eventToPromise = require('event-to-promise');

const { BU } = require('base-util-jh');
const config = require('./config');
const Main = require('../../../src/Main');
const CoreFacade = require('../../../src/core/CoreFacade');

const ThreCmdComponent = require('../../../src/core/CommandManager/Command/ThresholdCommand/ThreCmdComponent');

const Timeout = setTimeout(function() {}, 0).constructor;

const { goalDataRange } = ThreCmdComponent;

const { dcmConfigModel } = CoreFacade;

const {
  cmdStrategyType,
  commandStep: cmdStep,
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
const { coreFacade } = control;

const defaultTimeout = 10;

const pId = {
  RV: 'RV',
  SEA: 'SEA',
  NEB_1: 'NEB_1',
  NEB_2: 'NEB_2',
  NCB: 'NCB',
  SEB_1_A: 'SEB_1_A',
  SEB_1_B: 'SEB_1_B',
  SEB_1_C: 'SEB_1_C',
  SEB_1_D: 'SEB_1_D',
  SEB_2: 'SEB_2',
  SEB_3: 'SEB_3',
  SEB_4: 'SEB_4',
  BW_1: 'BW_1',
  BW_2: 'BW_2',
  BW_3: 'BW_3',
};

/** SingleControlValue 검색 형식 */
const sConV = {
  TRUE: { singleControlType: TRUE },
  REAL_TRUE: { singleControlType: TRUE, isIgnore: false },
  IGNORE_TRUE: { singleControlType: TRUE, isIgnore: true },
  FALSE: { singleControlType: FALSE },
  REAL_FALSE: { singleControlType: FALSE, isIgnore: false },
  IGNORE_FALSE: { singleControlType: FALSE, isIgnore: true },
};

/**
 * cmdStorage 내의 cmdElements nodeId 목록 반환
 * @param {cmdStorage} cmdStorage
 * @param {cmdElementSearch} cmdEleSearchInfo
 */
function getNodeIds(cmdStorage, cmdEleSearchInfo) {
  return cmdStorage.getCmdEleList(cmdEleSearchInfo).map(cmdEle => cmdEle.nodeId);
}

/**
 * 간단한 cmdStorage 내의 cmdElements 정보 반환
 * @param {CmdStorage} cmdStorage
 */
function getSimpleCmdElementsInfo(cmdStorage) {
  return _.map(cmdStorage.getCmdEleList(), cmdEle => {
    return {
      nodeId: cmdEle.nodeId,
      isIgnore: cmdEle.isIgnore,
      singleControlType: cmdEle.singleControlType,
      cmdEleStep: cmdEle.cmdEleStep,
    };
  });
}

/**
 * 기존 명령 객체 클론.
 * 요청 명령의 Wrap Cmd Type을 CANCEL 로 교체하여 반환
 * @param {reqFlowCmdInfo} reqFlowCmdInfo
 */
function convertConToCan(reqFlowCmdInfo) {
  return _.chain(reqFlowCmdInfo)
    .clone()
    .set('wrapCmdType', reqWCT.CANCEL)
    .value();
}

// 수동 전략
describe('Manual Strategy', function() {
  this.timeout(5000 * defaultTimeout);
  before(async () => {
    await control.init(dbInfo, config.uuid);
    await control.runFeature();
  });

  beforeEach(async () => {
    try {
      control.executeSetControl({
        wrapCmdId: 'closeAllDevice',
        wrapCmdType: reqWCT.CONTROL,
      });
      await eventToPromise(control, cmdStep.COMPLETE);
    } catch (error) {
      BU.error(error.message);
    }
  });

  /**
   * @desc T.C 1 [수동 모드]
   * @description
   * 1. 정기 계측 명령을 요청
   * 2. 정기 계측 명령을 중복하여 요청(예외 발생:무시되야 함)
   * 3. 명령 완료하였을 경우 명령 열에서 삭제 처리
   */
  it('Duplicate Measurement Command', async () => {
    const { cmdManager } = control.model;
    // * 1. 정기 계측 명령을 요청
    // return;
    const cmdStorage = control.inquiryAllDeviceStatus();
    expect(cmdStorage.wrapCmdFormat).to.eq(reqWCF.MEASURE);

    BU.CLI('TC_1 >>> 1 단계 완료');

    // * 2. 정기 계측 명령을 중복하여 요청(무시되야 함)
    expect(() => control.inquiryAllDeviceStatus()).to.throw(Error);
    BU.CLI('TC_1 >>> 2 단계 완료');

    // * 3. 명령 완료하였을 경우 명령 열에서 삭제 처리
    expect(cmdManager.getCmdStorageList({ wrapCmdFormat: reqWCF.MEASURE })).to.length(1);

    await eventToPromise(control, cmdStep.COMPLETE);

    // 정기 계측 명령 완료 했으므로
    expect(cmdManager.getCmdStorageList({ wrapCmdFormat: reqWCF.MEASURE })).to.length(0);
    BU.CLI('TC_1 >>> 3 단계 완료');
  });

  /**
   * @desc T.C 2 [수동 모드]
   * @description
   * 1. 수문 OPEN, 펌프 ON, 밸브 OPEN
   *  <test> 장치 동작 테스트
   *      명령 요청 >>> [WD_005][OPEN], [P_002][ON], [V_002][OPEN]
   *  <test> 명령 완료 후 명령 스택에서 삭제
   *      COMPLETE 이벤트 발생 3회 >>> 명령 스택에서 제거
   * 2. 수문 CLOSE, 수문 CLOSE, 펌프 OFF, 밸브 CLOSE
   *  <test> 중복 명령 발생 시 미처리
   *      명령 요청 >>> [WD_005][CLOSE], [WD_005][CLOSE]{Fail}, [P_002][OFF], [V_002][CLOSE]
   *      수문 CLOSE 1회 예외 발생
   * 3. 펌프 ON 명령 요청 후 펌프 명령 취소
   *  <test> 명령 수행 중에 명령 취소 발생 시 해당 명령 저장소에 취소 요청 처리 및 복원
   *      명령 요청 >>> [P_002][ON](R_CON), [P_002][ON](R_CAN)
   *  4. 펌프 ON 명령 요청 및 COMPLETE 이벤트 발생 후 펌프 ON 명령 취소
   *  <test> 명령 스택에 존재하지 않는 명령 취소 시 명령 저장소 생성 및 복원
   *      명령 요청 >>> [P_002][ON] COMPLETE 대기 >>> [P_002][ON](R_CAN)
   */
  it('Single Command Flow', async () => {
    const { cmdManager } = control.model;

    const pumpNodeId = 'P_001';

    /** @type {reqCmdEleInfo}  */
    const OPEN_GATE = {
      nodeId: 'WD_005',
      singleControlType: TRUE,
    };
    /** @type {reqCmdEleInfo}  */
    const CLOSE_GATE = {
      nodeId: 'WD_005',
      singleControlType: FALSE,
    };

    /** @type {reqCmdEleInfo} */
    const ON_PUMP = {
      nodeId: pumpNodeId,
      singleControlType: TRUE,
    };

    /** @type {reqCmdEleInfo} */
    const OFF_PUMP = {
      nodeId: pumpNodeId,
      singleControlType: FALSE,
    };

    /** @type {reqCmdEleInfo} */
    const OPEN_VALVE = {
      nodeId: 'V_002',
      singleControlType: TRUE,
    };

    /** @type {reqCmdEleInfo} */
    const CLOSE_VALVE = {
      nodeId: 'V_002',
      singleControlType: FALSE,
    };

    // * 1. 수문 OPEN, 펌프 ON, 밸브 OPEN
    // *  <test> 장치 동작 테스트
    // *      명령 요청 >>> [WD_005][OPEN], [P_002][ON], [V_002][OPEN]
    const cs_OPEN_GATE = control.executeSingleControl(OPEN_GATE);
    let cs_ON_PUMP = control.executeSingleControl(ON_PUMP);
    const cs_OPEN_VALVE = control.executeSingleControl(OPEN_VALVE);
    // *  <test> 명령 완료 후 명령 스택에서 삭제
    // *      COMPLETE 이벤트 발생 3회 >>> 명령 스택에서 제거
    await eventToPromise(control, cmdStep.COMPLETE);
    expect(cmdManager.getCmdStorageList()).to.length(2);

    await eventToPromise(control, cmdStep.COMPLETE);
    expect(cmdManager.getCmdStorageList()).to.length(1);

    await eventToPromise(control, cmdStep.COMPLETE);
    expect(cmdManager.getCmdStorageList()).to.length(0);

    BU.CLI('TC_2 >>> 1 단계 완료');

    // * 2. 수문 CLOSE, 수문 CLOSE, 펌프 OFF, 밸브 CLOSE
    // *  <test> 중복 명령 발생 시 미처리
    // *      명령 요청 >>> [WD_005][CLOSE], [WD_005][CLOSE]{Fail}, [P_002][OFF], [V_002][CLOSE]
    const cs_CLOSE_GATE = control.executeSingleControl(CLOSE_GATE);
    const cs_OFF_PUMP = control.executeSingleControl(OFF_PUMP);
    const cs_CLOSE_VALVE = control.executeSingleControl(CLOSE_VALVE);
    // *      수문 CLOSE 1회 예외 발생
    expect(() => control.executeSingleControl(CLOSE_GATE)).to.throw(Error);
    expect(cmdManager.getCmdStorageList()).to.length(3);
    await eventToPromise(control, cmdStep.COMPLETE);
    await eventToPromise(control, cmdStep.COMPLETE);
    await eventToPromise(control, cmdStep.COMPLETE);
    expect(cmdManager.getCmdStorageList()).to.length(0);

    BU.CLI('TC_2 >>> 2 단계 완료');

    // * 3. 펌프 ON 명령 요청 후 펌프 명령 취소
    // *  <test> 명령 수행 중에 명령 취소 발생 시 해당 명령 저장소에 취소 요청 처리 및 복원
    // *      명령 요청 >>> [P_002][ON](R_CON), [P_002][ON](R_CAN)
    cs_ON_PUMP = control.executeSingleControl(ON_PUMP);
    let cs_can_ON_PUMP = control.executeSingleControl(convertConToCan(ON_PUMP));

    // 진행 중인 명령 저장소에 취소 요청을 한 것이므로 같은 UUID를 가짐
    expect(cs_ON_PUMP.wrapCmdUuid).to.eq(cs_can_ON_PUMP.wrapCmdUuid);

    // 명령 취소 상태로 변경됨
    expect(cs_ON_PUMP.wrapCmdType).to.eq(reqWCT.CANCEL);

    await eventToPromise(control, cmdStep.END);
    // 펌프의 상태는 닫힘 상태
    expect(coreFacade.getNodeInfo(pumpNodeId).data).to.eq('OFF');

    expect(cmdManager.getCmdStorageList()).to.length(0);

    BU.CLI('TC_2 >>> 3 단계 완료');

    // *  4. 펌프 ON 명령 요청 및 COMPLETE 이벤트 발생 후 펌프 ON 명령 취소
    // *  <test> 명령 스택에 존재하지 않는 명령 취소 시 명령 저장소 생성 및 복원
    // *      명령 요청 >>> [P_002][ON] COMPLETE 대기 >>> [P_002][ON](R_CAN)
    cs_ON_PUMP = control.executeSingleControl(ON_PUMP);
    await eventToPromise(control, cmdStep.COMPLETE);
    cs_can_ON_PUMP = control.executeSingleControl(convertConToCan(ON_PUMP));
    // 존재하지 않는 명령 저장소에 취소 요청을 한 것이므로 다른 UUID를 가짐
    expect(cs_ON_PUMP.wrapCmdUuid).to.not.eq(cs_can_ON_PUMP.wrapCmdUuid);
    expect(cmdManager.getCmdStorageList()).to.length(1);
    await eventToPromise(control, cmdStep.COMPLETE);
    expect(cmdManager.getCmdStorageList()).to.length(0);

    BU.CLI('TC_2 >>> 4 단계 완료');
    // 명령 완료 순서는 DPC 각 장치별 제어에 따른 status 지연 명령 시간에 따라 결정

    // BU.CLIN(control.nodeList);
  });

  /**
   * @desc T.C 3 [수동 모드]
   * @description
   * @tutorial
   * 1. 수문 5번 Open, 펌프 1번 On
   * [WD_005_OPEN](R_CON), [P_001_ON](R_CON)
   * 2. closeAllDevice Set 명령 호출 시 수문 5 번, 펌프 1번 Close/Off 동작 확인
   *  <test> 모든 장치 Close 명령 요청 시 존재하는 명령만 수행 여부 테스트
   * 3. 수문 5번 Open, 펌프 1번 On, 밸브 2번 Open
   * 3. rainMode Set 명령 호출 시
   */
  it.skip('Set Command', async () => {});

  /**
   * @desc T.C 4 [수동 모드]
   */
  it.skip('Flow Command', async () => {});
});

// 누적 카운팅 전략
describe('OverlapCount Strategy', function() {
  this.timeout(10000 * defaultTimeout);

  /** @type {reqFlowCmdInfo} 저수지 > 증발지 1-A */
  const RV_TO_SEB_1_A = {
    srcPlaceId: 'RV',
    destPlaceId: 'SEB_1_A',
    wrapCmdType: reqWCT.CONTROL,
  };

  /** @type {reqFlowCmdInfo} 저수지 > 증발지 1-B */
  const RV_TO_SEB_1_B = {
    srcPlaceId: 'RV',
    destPlaceId: 'SEB_1_B',
    wrapCmdType: reqWCT.CONTROL,
  };

  /** @type {reqFlowCmdInfo} 증발지 1-A > 해주 1 */
  const SEB_1_A_TO_BW_1 = {
    srcPlaceId: 'SEB_1_A',
    destPlaceId: 'BW_1',
    wrapCmdType: reqWCT.CONTROL,
  };

  before(async () => {
    await control.init(dbInfo, config.uuid);
    await control.runFeature();

    control.inquiryAllDeviceStatus();

    await eventToPromise(control, cmdStep.COMPLETE);
  });

  beforeEach(async () => {
    try {
      coreFacade.coreAlgorithm.cmdStrategy !== cmdStrategyType.MANUAL &&
        coreFacade.changeCmdStrategy(cmdStrategyType.MANUAL);

      control.executeSetControl({
        wrapCmdId: 'closeAllDevice',
        wrapCmdType: reqWCT.CONTROL,
      });

      await eventToPromise(control, cmdStep.COMPLETE);
    } catch (error) {
      BU.error(error);
    }

    coreFacade.changeCmdStrategy(cmdStrategyType.OVERLAP_COUNT);
  });

  /**
   * @desc T.C 5 [자동 모드]
   * 다중 흐름 명령을 요청하고 이에 반하는 흐름 명령을 요청하여 충돌 체크가 제대로 동작하는지 확인
   * @description
   * 1. 저수지 > 증발지 1-A 명령 요청
   *      명령 요청 >>> [RV_TO_SEB_1_A](R_CON)
   *      REAL_TRUE: ['V_006','V_001','P_002'], IGNORE_TRUE: []
   *      REAL_FALSE: [], IGNORE_FALSE: ['GV_001']
   * 2. 저수지 > 증발지 1-B 명령 요청. 명령 충돌 발생 X
   *      명령 요청 >>> [RV_TO_SEB_1_B](R_CON)
   *      REAL_TRUE: ['V_002'], IGNORE_TRUE: ['V_006','P_002']
   *      REAL_FALSE: [], IGNORE_FALSE: ['GV_002']
   * 3. 증발지 1-A > 해주 1 명령 요청. ['GV_001'] 과의 충돌 발생
   *  <test> 자동 명령에서는 명령 충돌 시 수행하지 않음
   *      명령 요청 >>> [SEB_1_A_TO_RV](R_CON){Expect Fail}
   * 4. 증발지 1-A > 해주 1 명령 취소. 존재하지 않으므로 X
   *  <test> 실행 중인 명령이 존재하지 않을 경우 명령 취소 불가
   *      명령 요청 >>> [SEB_1_A_TO_RV](R_CAN){Expect Fail}
   * 5. 저수지 > 증발지 1-A 명령 취소.
   *  <test> True 누적 카운팅 제거 시 장치 상태 False로 복원
   *      명령 요청 >>> [RV_TO_SEB_1_A](R_CAN). ['V_001'](R_RES)
   * 6. 증발지 1-A > 해주 1 명령 요청.
   *      명령 요청 >>> [SEB_1_A_TO_RV](R_CON)
   *      REAL_TRUE: ['GV_001','WD_013','WD_010'], IGNORE_TRUE: []
   *      REAL_FALSE: [], IGNORE_FALSE: ['WD_016]
   * 7. 저수지 > 증발지 1-B 명령 취소.
   *      명령 요청 >>> [RV_TO_SEB_1_B](R_CAN). ['P_002','V_002','V_006'](R_RES) 취소는 역순
   * 8. 증발지 1-A > 해주 1 명령 취소.
   *      모든 장치 False, 명령 스택 X
   */
  it('Multi Flow Command Control & Conflict & Cancel', async () => {
    const { cmdManager } = control.model;
    // BU.CLI('Multi Flow Command Control & Conflict & Cancel');
    // 1. 저수지 > 증발지 1-A 명령 요청. 펌프 2, 밸브 6, 밸브 1 . 실제 제어 true 확인 및 overlap 확인
    // *      명령 요청 >>> [RV_TO_SEB_1_A](R_CON)

    const cs_RV_TO_SEB_1_A = control.executeFlowControl(RV_TO_SEB_1_A);

    // 동일 명령 요청 시 예외
    expect(() => control.executeFlowControl(RV_TO_SEB_1_A)).to.throw(
      'wrapCmdId: RV_TO_SEB_1_A is exist.',
    );
    const ceList_RV_TO_SEB_1_A = cmdManager.getCmdStorage({
      wrapCmdUuid: cs_RV_TO_SEB_1_A.cmdStorageUuid,
    });

    // BU.CLIN(cs_RV_TO_SEB_1_A.getCmdEleList({ singleControlType: TRUE }), 1);
    // * REAL_TRUE: ['V_006','V_001','P_002'], IGNORE_TRUE: []
    expect(getNodeIds(cs_RV_TO_SEB_1_A, sConV.REAL_TRUE)).to.deep.equal([
      'V_006',
      'V_001',
      'P_002',
    ]);

    // * REAL_FALSE: [], IGNORE_FALSE: ['GV_001']
    expect(getNodeIds(cs_RV_TO_SEB_1_A, sConV.IGNORE_FALSE)).to.deep.equal(['GV_001']);

    BU.CLI('TC_5 >>> 1 단계 완료');

    // * 2. 저수지 > 증발지 1-B 명령 요청. 실제 제어 추가 확인 V_002
    // *      명령 요청 >>> [RV_TO_SEB_1_B](R_CON)
    let cs_RV_TO_SEB_1_B = control.executeFlowControl(RV_TO_SEB_1_B);

    // * REAL_TRUE: ['V_002'], IGNORE_TRUE: ['V_006','P_002']
    expect(getNodeIds(cs_RV_TO_SEB_1_B, sConV.REAL_TRUE)).to.deep.equal(['V_002']);
    expect(getNodeIds(cs_RV_TO_SEB_1_B, sConV.IGNORE_TRUE)).to.deep.equal(['V_006', 'P_002']);
    // * REAL_FALSE: [], IGNORE_FALSE: ['GV_002']
    expect(getNodeIds(cs_RV_TO_SEB_1_B, sConV.IGNORE_FALSE)).to.deep.equal(['GV_002']);

    // 실제 여는 장치 목록 ['V_006', 'V_001', 'V_002', 'P_002'],
    expect(
      cmdManager.getCmdEleList({
        singleControlType: TRUE,
        isIgnore: false,
      }),
    ).to.length(4);

    // 무시 닫는 장치 목록 ['GV_001', 'GV_002'],
    expect(
      cmdManager.getCmdEleList({
        singleControlType: FALSE,
        isIgnore: true,
      }),
    ).to.length(2);

    // 실행되고 있는 명령 2개
    expect(cmdManager.getCmdStorageList()).to.length(2);

    // 저수지 > 증발지 1-A 명령 완료.
    await eventToPromise(control, cmdStep.COMPLETE);
    // 저수지 > 증발지 1-B 명령 완료.
    await eventToPromise(control, cmdStep.COMPLETE);
    // 현재 실행중인 명령은 2개
    expect(cmdManager.getCmdStorageList()).to.length(2);
    BU.CLI('TC_5 >>> 2 단계 완료');

    // * 3. 증발지 1-A > 해주 1 명령 요청. ['GV_001'] 과의 충돌 발생
    // *  <test> 자동 명령에서는 명령 충돌 시 수행하지 않음
    // *      명령 요청 >>> [SEB_1_A_TO_RV](R_CON){Expect Fail}
    expect(() => control.executeFlowControl(SEB_1_A_TO_BW_1)).to.throw(
      'SEB_1_A_TO_BW_1 and RV_TO_SEB_1_A conflicted with GV_001.',
    );
    BU.CLI('TC_5 >>> 3 단계 완료');
    // * 4. 증발지 1-A > 해주 1 명령 취소. 존재하지 않으므로 X
    // *  <test> 실행 중인 명령이 존재하지 않을 경우 명령 취소 불가

    // *      명령 요청 >>> [SEB_1_A_TO_RV](R_CAN){Expect Fail}
    expect(() => control.executeFlowControl(convertConToCan(SEB_1_A_TO_BW_1))).to.throw(
      'FLOW >>> SEB_1_A_TO_BW_1 does not exist.',
    );
    BU.CLI('TC_5 >>> 4 단계 완료');

    // * 5. 저수지 > 증발지 1-A 명령 취소.
    // *  <test> True 누적 카운팅 제거 시 장치 상태 False로 복원
    // *      명령 요청 >>> [RV_TO_SEB_1_A](R_CAN). ['V_001_Close'](R_RES)
    const cs_can_RV_TO_SEB_1_A = control.executeFlowControl(convertConToCan(RV_TO_SEB_1_A));

    expect(getNodeIds(cs_can_RV_TO_SEB_1_A, sConV.REAL_FALSE)).to.deep.eq(['V_001']);

    // 명령 취소 상태로 변경됨
    expect(
      cmdManager.getCmdStorage({ wrapCmdUuid: cs_RV_TO_SEB_1_A.cmdStorageUuid }).wrapCmdType,
    ).to.eq(reqWCT.CANCEL);

    const end_can_RV_TO_SEB_1_A = await eventToPromise(control, cmdStep.END);
    expect(end_can_RV_TO_SEB_1_A).to.deep.eq(cs_can_RV_TO_SEB_1_A);
    // 명령 cmdStep END 발생 시 cmdManager.commandList 스택에서 제거됨
    expect(cmdManager.getCmdStorage({ wrapCmdUuid: cs_RV_TO_SEB_1_A.cmdStorageUuid })).to.be
      .undefined;
    BU.CLI('TC_5 >>> 5 단계 완료');

    // * 6. 증발지 1-A > 해주 1 명령 요청.
    // *      명령 요청 >>> [SEB_1_A_TO_RV](R_CON)
    let cs_SEB_1_A_TO_BW_1 = control.executeFlowControl(SEB_1_A_TO_BW_1);

    await eventToPromise(control, cmdStep.COMPLETE);

    // *      REAL_TRUE: ['GV_001','WD_013','WD_010'], IGNORE_TRUE: []
    // *      REAL_FALSE: [], IGNORE_FALSE: ['WD_016]
    expect(getNodeIds(cs_SEB_1_A_TO_BW_1, sConV.REAL_TRUE)).to.deep.eq([
      'GV_001',
      'WD_013',
      'WD_010',
    ]);

    // BU.CLI(_.map(cmdManager.getCmdStorageList(), getSimpleCmdElementsInfo));

    // _.map(cmdManager.getCmdStorageList(), storage => {
    //   BU.CLI(storage.wrapCmdId, getNodeIds(storage, sConV.TRUE));
    // });

    // 실제 총 True 장치 목록 ['V_006','V_002','P_002','GV_001','WD_010','WD_013'],
    expect(
      cmdManager.getCmdEleList({
        singleControlType: TRUE,
      }),
    ).to.length(6);

    // 실제 총 False 장치 목록 ['GV_002','WD_016'],
    expect(
      cmdManager.getCmdEleList({
        singleControlType: FALSE,
      }),
    ).to.length(2);

    BU.CLI('TC_5 >>> 6 단계 완료');

    // * 7. 저수지 > 증발지 1-B 명령 취소.
    // *      명령 요청 >>> [RV_TO_SEB_1_B](R_CAN). ['P_002','V_002','V_006'](R_RES)
    cs_RV_TO_SEB_1_B = control.executeFlowControl(convertConToCan(RV_TO_SEB_1_B));

    await eventToPromise(control, cmdStep.END);

    // * 'P_002', 'V_002', 'V_006' 순으로 닫힘.
    expect(getNodeIds(cs_RV_TO_SEB_1_B, sConV.REAL_FALSE)).to.deep.eq(['P_002', 'V_002', 'V_006']);
    // True 장치는 없어야 한다. 명령 취소를 한 것이기 때문
    expect(getNodeIds(cs_RV_TO_SEB_1_B, sConV.TRUE)).to.length(0);

    // 실제 총 True 장치 목록 ['GV_001','WD_010','WD_013'],
    expect(
      cmdManager.getCmdEleList({
        singleControlType: TRUE,
        isIgnore: false,
      }),
    ).to.length(3);

    // 실제 무시 중인 총 False 장치 목록 ['WD_016'],
    expect(
      cmdManager.getCmdEleList({
        singleControlType: FALSE,
        isIgnore: true,
      }),
    ).to.length(1);

    BU.CLI('TC_5 >>> 7 단계 완료');

    // * 8. 증발지 1-A > 해주 1 명령 취소.
    // *      모든 장치 False, 명령 스택 X
    cs_SEB_1_A_TO_BW_1 = control.executeFlowControl(convertConToCan(SEB_1_A_TO_BW_1));

    await eventToPromise(control, cmdStep.END);

    // * ['WD_010', 'WD_013', 'GV_001'] 순으로 닫힘.
    expect(getNodeIds(cs_SEB_1_A_TO_BW_1, sConV.REAL_FALSE)).to.deep.eq([
      'WD_010',
      'WD_013',
      'GV_001',
    ]);
    // True 장치는 없어야 한다. 명령 취소를 한 것이기 때문
    expect(getNodeIds(cs_SEB_1_A_TO_BW_1, sConV.TRUE)).to.length(0);

    // *      모든 장치 True는 Close 상태
    expect(
      cmdManager.getCmdEleList({
        singleControlType: TRUE,
      }),
    ).to.length(0);

    // 실제 총 False 장치 목록 [],
    expect(
      cmdManager.getCmdEleList({
        singleControlType: FALSE,
      }),
    ).to.length(0);

    expect(cmdManager.getCmdStorageList()).to.length(0);

    BU.CLI('TC_5 >>> 8 단계 완료');
  });

  /**
   * @desc T.C 6 [자동 모드]
   * 달성 목표가 있는 명령은 장치 제어 완료 시 COMPLETE 메시지 대신 RUNNING 이벤트 발송
   * 달성 목표 도달 시 cmdManager 명령 스택에서 제거
   * @description
   * 1. 저수지 > 증발지 1-A 명령 요청. 달성 제한 시간만 존재
   *  <test> 달성 시간만 존재하였을 경우 오류 없이 생성 및 달성 시간 초과 시 명령 종료
   *      명령 요청 >>> [RV_TO_NEB_1_A](R_CON) :: 달성 제한 시간: 1 Sec
   *    1초 대기 >>> 제한 시간 초과로 인한 목표 달성 >>> [RV_TO_NEB_1_A][END]
   *  <test> 명령 스택 제거 시 명령 스택에서 사라지는 장치 복원
   *      ['P_002','V_006','V_001'](R_RES)
   * 2. 밸브 1 OPEN 명령 요청.
   *      명령 요청 >>> [V_001][ON](R_CON)
   *  저수지 > 증발지 1-A 명령 요청. 달성 목표: SEB_1_A_NODE_WL = 10
   *  <test> 달성 목표만 주었을 경우 시간 타이머 임계치 객체는 생성되지 않으며 명령 도달 시 명령 종료
   *      명령 요청 >>> [RV_TO_NEB_1_A](R_CON) :: 달성 목표: SEB_1_A_NODE_WL.10 UPPER
   *    WL_001 = 10
   *      목표 달성 >>> [RV_TO_NEB_1_A][END]
   *  <test> 명령 스택 제거 시 존재하는 명령 제외 복원. V_001 점유하고 있기때문에 제외
   *      ['P_002','V_006'](R_RES)
   * 3. 저수지 > 증발지 1-A 명령 요청. 달성 제한 시간: 2 Sec. 다수 목표
   *  <test> 달성 목표를 이미 달성하였다면 바로 명령 종료.
   *  <test> 다수 목표 중 isCompleteClear.ture 가 목표치를 완료했다면 즉시 종료
   *      명령 요청 >>> [RV_TO_NEB_1_A](R_CON) ::
   *      현재 값 달성치 도달  >>> [RV_TO_NEB_1_A][END]
   * 4. 저수지 > 증발지 1-A 명령 요청.
   *  달성 목표: WL_001 >= 10, BT <= 30, MRT <= 50, 제한 시간 2 Sec
   *      명령 요청 >>> [RV_TO_NEB_1_A](R_CON)
   *  <test> 다수 달성 목표가 존재할 경우 isCompleteClear.true 개체가 없을 시 모든 목표 달성 시 종료
   */
  it('Threshold Command ', async () => {
    const { cmdManager } = control.model;
    // BU.CLI('Critical Command');
    const SEB_1_A_NODE_WL = 'WL_001';
    const SEB_1_A_NODE_MRT = 'MRT_001';
    const SEB_1_A_NODE_BT = 'BT_001';
    const SEB_1_A_NODE_GV = 'GV_001';
    const SEB_1_A_NODE_V_1 = 'V_001';
    const SEB_1_A_NODE_V_6 = 'V_006';
    const SEB_1_A_NODE_P = 'P_002';
    const NODE_WL = _.find(control.nodeList, { node_id: SEB_1_A_NODE_WL });
    const NODE_BT = _.find(control.nodeList, { node_id: SEB_1_A_NODE_BT });
    const NODE_MRT = _.find(control.nodeList, { node_id: SEB_1_A_NODE_MRT });
    const NODE_GV = _.find(control.nodeList, { node_id: SEB_1_A_NODE_GV });
    const NODE_V_1 = _.find(control.nodeList, { node_id: SEB_1_A_NODE_V_1 });
    const NODE_V_6 = _.find(control.nodeList, { node_id: SEB_1_A_NODE_V_6 });
    const NODE_P = _.find(control.nodeList, { node_id: SEB_1_A_NODE_P });

    // 최초 수위는 1cm로 설정
    NODE_WL.data = 1;
    control.notifyDeviceData(null, [NODE_WL]);
    // 염수 온도 30도로 설정
    NODE_BT.data = 30;
    // 모듈 후면 온도 50도로 설정
    NODE_MRT.data = 50;

    const TC_1_RV_TO_SEB_1_A = _.clone(RV_TO_SEB_1_A);
    const TC_2_RV_TO_SEB_1_A = _.clone(RV_TO_SEB_1_A);
    const TC_3_RV_TO_SEB_1_A = _.clone(RV_TO_SEB_1_A);
    const TC_4_RV_TO_SEB_1_A = _.clone(RV_TO_SEB_1_A);

    // TC 1. 단일 시간만 존재 (1초)
    TC_1_RV_TO_SEB_1_A.wrapCmdGoalInfo = {
      limitTimeSec: 1,
    };

    // TC 2. 목표만 존재
    TC_2_RV_TO_SEB_1_A.wrapCmdGoalInfo = {
      goalDataList: [
        {
          goalValue: 10,
          goalRange: goalDataRange.UPPER,
          nodeId: SEB_1_A_NODE_WL,
        },
      ],
    };

    // TC 3. 달성 제한 시간 및 다수 목표 중 하나에 중요 완료(수위) 해제 지정
    TC_3_RV_TO_SEB_1_A.wrapCmdGoalInfo = {
      limitTimeSec: 2,
      goalDataList: [
        {
          goalValue: 10,
          goalRange: goalDataRange.UPPER,
          nodeId: SEB_1_A_NODE_WL,
          isCompleteClear: true,
        },
        {
          goalValue: 30,
          goalRange: goalDataRange.LOWER,
          nodeId: SEB_1_A_NODE_BT,
        },
        {
          goalValue: 50,
          goalRange: goalDataRange.LOWER,
          nodeId: SEB_1_A_NODE_MRT,
        },
      ],
    };

    // TC 4. 달성 제한 시간 및 다수 목표를 완료해야하는 목표 설정
    TC_4_RV_TO_SEB_1_A.wrapCmdGoalInfo = {
      limitTimeSec: 2,
      goalDataList: [
        {
          goalValue: 10,
          goalRange: goalDataRange.UPPER,
          nodeId: SEB_1_A_NODE_WL,
        },
        {
          goalValue: 30,
          goalRange: goalDataRange.LOWER,
          nodeId: SEB_1_A_NODE_BT,
        },
        {
          goalValue: 50,
          goalRange: goalDataRange.LOWER,
          nodeId: SEB_1_A_NODE_MRT,
        },
      ],
    };

    /** @type {reqCmdEleInfo} 1. 수문 5번을 연다. */
    const OPEN_VALVE_1 = {
      nodeId: SEB_1_A_NODE_V_1,
      singleControlType: TRUE,
    };

    // * 1. 저수지 > 증발지 1-A 명령 요청. 달성 제한 시간만 존재
    // *  <test> 달성 시간만 존재하였을 경우 오류 없이 생성 및 달성 시간 초과 시 명령 종료
    // *      명령 요청 >>> [RV_TO_NEB_1_A](R_CON) :: 달성 제한 시간: 2 Sec
    const cs_TC_1_RV_TO_SEB_1_A = control.executeFlowControl(TC_1_RV_TO_SEB_1_A);
    // 아직 임계 명령은 활성화되지 않음
    expect(cs_TC_1_RV_TO_SEB_1_A.thresholdStorage).to.undefined;

    await eventToPromise(control, cmdStep.RUNNING);
    // 타이머 임계 객체 설정되어 있음
    expect(cs_TC_1_RV_TO_SEB_1_A.thresholdStorage.threCmdLimitTimer).to.instanceOf(Timeout);
    // 임계 명령 생성됨
    // 명령 제한 시간만 존재하므로 세부 달성 객체는 생성되지 않음
    expect(cs_TC_1_RV_TO_SEB_1_A.thresholdStorage.threCmdGoalList).to.length(0);
    // *    1초 대기 >>> 제한 시간 초과로 인한 목표 달성 >>> [RV_TO_NEB_1_A][END]
    await eventToPromise(control, cmdStep.END);

    // 명령 스택에서 제거되면서 장치 복원
    expect(NODE_V_1.data).to.eq('CLOSE');
    expect(NODE_V_6.data).to.eq('CLOSE');
    expect(NODE_P.data).to.eq('OFF');

    // 명령이 완료되기를 기다림
    expect(cmdManager.getCmdStorageList()).to.length(0);

    BU.CLI('TC_6 >>> 1 단계 완료');

    // await Promise.delay(2000);

    // * 2. 밸브 1 OPEN 명령 요청.
    // *      명령 요청 >>> [V_001][ON](R_CON)
    const cs_OPEN_VALVE_1 = control.executeSingleControl(OPEN_VALVE_1);
    await eventToPromise(control, cmdStep.COMPLETE);
    // *  저수지 > 증발지 1-A 명령 요청. 달성 목표: SEB_1_A_NODE_WL = 10
    // *  <test> 달성 목표만 주었을 경우 시간 타이머 임계치 객체는 생성되지 않으며 명령 도달 시 명령 종료
    // *      명령 요청 >>> [RV_TO_NEB_1_A](R_CON) :: 달성 목표: SEB_1_A_NODE_WL.10 UPPER
    const cs_TC_2_RV_TO_SEB_1_A = control.executeFlowControl(TC_2_RV_TO_SEB_1_A);

    await eventToPromise(control, cmdStep.RUNNING);
    // 시간 임계치는 설정 값이 없으므로 존재치 않음
    expect(cs_TC_2_RV_TO_SEB_1_A.thresholdStorage.threCmdLimitTimer).to.undefined;

    // 실행되고 있는 임계 목표 객체를 가져옴
    const threGoal_NODE_WL = cs_TC_2_RV_TO_SEB_1_A.thresholdStorage.getThreCmdGoal(NODE_WL);
    const nodeUpdator_NODE_WL = control.nodeUpdatorManager.getNodeUpdator(NODE_WL);
    // Node Updator에 등록되어 있는 노드는 1개
    expect(nodeUpdator_NODE_WL.getObserver(threGoal_NODE_WL)).to.eq(threGoal_NODE_WL);
    // BU.CLIN(nodeUpdator_NODE_WL.nodeObservers);
    // PlaceNode 객체, 임계 목표 객체
    expect(nodeUpdator_NODE_WL.observers).to.length(2);

    // *    WL_001 = 10
    NODE_WL.data = 10;
    control.notifyDeviceData(null, [NODE_WL]);

    // *      목표 달성 >>> [RV_TO_NEB_1_A][END]
    await eventToPromise(control, cmdStep.END);
    // *  <test> 명령 스택 제거 시 존재하는 명령 제외 복원. V_001 점유하고 있기때문에 제외
    // *      ['P_002','V_006'](R_RES)
    expect(NODE_V_1.data).to.eq('OPEN');
    expect(NODE_V_6.data).to.eq('CLOSE');
    expect(NODE_P.data).to.eq('OFF');

    // BU.CLI(getSimpleCmdElementsInfo(cs_TC_2_RV_TO_SEB_1_A));

    // *    증발지 1-A 결정지의 수위를 Set값(10cm) 설정.

    BU.CLI('TC_6 >>> 2 단계 완료');

    // * 3. 저수지 > 증발지 1-A 명령 요청. 달성 제한 시간: 2 Sec. 다수 목표
    const cs_TC_3_RV_TO_SEB_1_A = control.executeFlowControl(TC_3_RV_TO_SEB_1_A);
    // *  <test> 달성 목표를 이미 달성하였다면 바로 명령 종료.
    // *  <test> 다수 목표 중 isCompleteClear.ture 가 목표치를 완료했다면 즉시 종료
    // *      명령 요청 >>> [RV_TO_NEB_1_A](R_CON) ::
    // *      현재 값 달성치 도달  >>> [RV_TO_NEB_1_A][END]
    await eventToPromise(control, cmdStep.END);

    BU.CLI('TC_6 >>> 3 단계 완료');

    // * 4. 저수지 > 증발지 1-A 명령 요청. 달성 목표: 배수지 수위 (2cm) 이하, 급수지 수위(10cm 이상), 제한 시간 2 Sec
    const cs_TC_4_RV_TO_SEB_1_A = control.executeFlowControl(TC_4_RV_TO_SEB_1_A);
    await eventToPromise(control, cmdStep.RUNNING);
    // *  달성 목표: WL_001 >= 10, BT <= 30, MRT <= 50, 제한 시간 2 Sec
    // BT = 25, 염수 온도를 목표치 이하로 설정
    NODE_BT.data = 25;
    control.notifyDeviceData(null, [NODE_BT]);

    // MRT = 45, 모듈 뒷면 온도를 목표치 이하로 설정
    NODE_MRT.data = 45;
    control.notifyDeviceData(null, [NODE_MRT]);

    // *  <test> 다수 달성 목표가 존재할 경우 isCompleteClear.true 개체가 없을 시 모든 목표 달성 시 종료
    await eventToPromise(control, cmdStep.END);

    // Single 명령 V_001 Open 점유 중
    expect(
      cmdManager.getCmdEleList({
        singleControlType: TRUE,
      }),
    ).to.length(1);

    // V_001 Open 명령 취소
    control.executeSingleControl(convertConToCan(OPEN_VALVE_1));

    await eventToPromise(control, cmdStep.END);

    // *      모든 장치 True는 Close 상태
    expect(
      cmdManager.getCmdEleList({
        singleControlType: TRUE,
      }),
    ).to.length(0);

    // 실제 총 False 장치 목록 [],
    expect(
      cmdManager.getCmdEleList({
        singleControlType: FALSE,
      }),
    ).to.length(0);

    expect(cmdManager.getCmdStorageList()).to.length(0);

    BU.CLI('TC_6 >>> 4 단계 완료');
  });
});

process.on('uncaughtException', err => {
  // BU.debugConsole();
  console.error(err.stack);
  console.log(err.message);
  console.log('Node NOT Exiting...');
});

process.on('unhandledRejection', err => {
  // BU.debugConsole();
  // BU.CLI(err);
  console.log('Node NOT Exiting...');
});
