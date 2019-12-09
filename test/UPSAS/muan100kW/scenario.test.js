/* eslint-disable camelcase */
require('dotenv').config();
const _ = require('lodash');
const Promise = require('bluebird');
const { expect } = require('chai');

const eventToPromise = require('event-to-promise');

const { BU } = require('base-util-jh');
const config = require('./config');
const Main = require('../../../src/Main');

const CoreFacade = require('../../../src/core/CoreFacade');

const scenarioList = require('./scenarioList');

const { dcmConfigModel } = CoreFacade;

const {
  controlMode,
  ndId,
  pId,
  setNodeData,
  convertConToCan,
  getNodeIds,
  getSimpleCmdElementsInfo,
  sConV,
  updateNode,
  updatePlace,
} = require('./guide.util');

const {
  commandStep: cmdStep,
  goalDataRange: goalDR,
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

const notifyDelayNode = updateNode(control);
const notifyDirectNode = updateNode(control, false);
const notifyDelayNodePlace = updatePlace(control);
const notifyDirectNodePlace = updatePlace(control, false);

const coreFacade = new CoreFacade();

const DPC_DELAY_MS = 1000;

describe('시나리오 동작 테스트', function() {
  this.timeout(10000);

  before(async () => {
    await control.init(dbInfo, config.uuid);
    control.runFeature();

    BU.CLI('inquiryAllDeviceStatus');
    control.inquiryAllDeviceStatus();

    await eventToPromise(control, cmdStep.COMPLETE);
  });

  beforeEach(async () => {
    // try {
    //   control.executeSetControl({
    //     wrapCmdId: 'closeAllDevice',
    //     wrapCmdType: reqWCT.CONTROL,
    //   });
    //   await eventToPromise(control, cmdStep.COMPLETE);
    // } catch (error) {
    //   BU.error(error.message);
    // }
  });

  /**
   * 우천 모드 시나리오를 진행하고 모든 요건을 만족시키는지 테스트
   * @description
   * MSC: Main Scenario CMD (동기)
   *  [주 명령 처리자: 명령의 처리를 완료했을 경우 다음 명령 실행]
   * SSC: Sub Scenario CMD (비동기)
   *  [서브 명령 처리자: 모든 명령을 동시에 요청하고 완료 될 경우 해당 요소 삭제]
   * ESC: Element Scenario CMD (동기)
   *  [요소 명령 처리자: 명령의 처리를 완료했을 경우 다음 명령 실행]
   * @tutorial
   * 1. 'closeAllDevice' Set 명령 요청 [Step_1]
   *  <test> Set 명령 정상적으로 수행 여부
   *  <test> MSC 동기 처리 여부 >>> 명령 수행 중 [Step_2]로 넘어가지 않는지 여부
   *  <test> Goal이 없는 명령일 경우 장치 제어 완료 후 명령 Stack에서 제거 여부
   *  >>> [CLOSE_ALL_DEVICE][COMPLETE]
   * 2. 염수 대피 [Step_2]
   *  <test> SSC 비동기 처리 여부 >>> 결정지 염수 이동, 수중 태양광 증발지 그룹 2, 1 염수 이동, 일반 증발지 염수 이동 동시 실행 여부
   *  >>> (1) [NCB_TO_BW_5][RUNNING],[NCB_TO_SEA][WAIT]
   *  >>> (2) [SEB_TWO_TO_BW_3][RUNNING],[SEB_TWO_TO_SEA][WAIT]
   *  >>> (3) [SEB_ONE_TO_BW_2][RUNNING],[SEB_ONE_TO_SEA][WAIT]
   *  >>> (4) [NEB_2_TO_BW_1][RUNNING],[NEB_2_TO_SEA][WAIT]
   *  >>> (5) [NEB_1_TO_SEA][COMPLETE]
   *  <test> Goal 없는 Flow 명령 완료 시 삭제 여부
   *    명령 완료 >>> [NEB_1_TO_SEA](DEL)
   *  NCB_TO_BW_5.WL = 1, 명령 목표
   *  <test> FLOW 명령. Single 설정 목표 달성으로 인한 ESC 명령 Stack 제거 및 Next ESC 명령 요청
   *  >>> (1) [NCB_TO_BW_5][END],[NCB_TO_SEA][COMPLETE]
   *  >>> (2) [SEB_TWO_TO_BW_3][RUNNING],[SEB_TWO_TO_SEA][WAIT]
   *  >>> (3) [SEB_ONE_TO_BW_2][RUNNING],[SEB_ONE_TO_SEA][WAIT]
   *  >>> (4) [NEB_2_TO_BW_1][RUNNING],[NEB_2_TO_SEA][WAIT]
   *  SEB_6.WL = 1, SEB_7.WL = 1, SEB_7.WL = 1 순차적으로 실행.
   *  <test> Flow 명령. Multi 설정 목표 달성으로 인한 ESC 명령 Stack 제거 및 Next ESC 명령 요청
   *  >>> (2) [SEB_TWO_TO_BW_3][END],[SEB_TWO_TO_SEA][COMPLETE]
   *  >>> (3) [SEB_ONE_TO_BW_2][RUNNING],[SEB_ONE_TO_SEA][WAIT]
   *  >>> (4) [NEB_2_TO_BW_1][RUNNING],[NEB_2_TO_SEA][WAIT]
   *  BW_2.WL = 150. 급수지 수위 최대치에 의한 명령 취소
   *  <test> Flow 명령. 급수지 수위 최대치에 의한 명령 취소 여부
   *  >>> (3) [SEB_ONE_TO_BW_2][END],[SEB_ONE_TO_SEA][COMPLETE]
   *  >>> (4) [NEB_2_TO_BW_1][RUNNING],[NEB_2_TO_SEA][WAIT]
   *  NEB_2.WL = 1
   *  >>> (4) [NEB_2_TO_BW_1][END],[NEB_2_TO_SEA][COMPLETE]
   *  <test> [Step_2] All SSC 명령 완료 후 Next MSC 진행 여부
   * 3. 바다로 ~ [Step_3]
   *    'rainMode' Set 명령 실행 여부
   *  >>> [SET_RAIN_MODE][COMPLETE]
   */
  it('우천 모드', async () => {
    BU.CLI(control.controlModeUpdator.modeInfo);
    const { cmdManager, placeManager, scenarioManager } = control.model;
    // 시나리오 입힘
    scenarioManager.scenarioCmdList = scenarioList;

    scenarioManager.initScenario({ wrapCmdId: 'rainMode' });

    const mainScenarioStorage = scenarioManager.scenarioStorage;
    // * 1. 'closeAllDevice' Set 명령 요청 [Step_1]
    // *  <test> Set 명령 정상적으로 수행 여부
    const sc_CLOSE_ALL_DEVICE = mainScenarioStorage.getRunningScenario();
    // BU.CLIN(sc_CLOSE_ALL_DEVICE);
    expect(sc_CLOSE_ALL_DEVICE.getWrapCmdId()).to.eq('closeAllDevice');

    // *  <test> MSC 동기 처리 여부 >>> 명령 수행 중 [Step_2]로 넘어가지 않는지 여부
    expect(mainScenarioStorage.executeIndex).to.eq(0);

    expect(sc_CLOSE_ALL_DEVICE.isScenarioClear()).to.false;

    // *  >>> [CLOSE_ALL_DEVICE][COMPLETE]
    /** @type {CmdStorage} */
    const cs_SET_CLOSE_ALL_DEVICE = await eventToPromise(control, cmdStep.COMPLETE);
    // 명령 종료됨.
    expect(sc_CLOSE_ALL_DEVICE.isScenarioClear()).to.true;

    expect(cs_SET_CLOSE_ALL_DEVICE.wrapCmdId).to.equal('closeAllDevice');
    // *  <test> Goal이 없는 명령일 경우 장치 제어 완료 후 명령 Stack에서 제거 여부
    expect(mainScenarioStorage.executeIndex).to.eq(1);

    BU.CLI('TC_1 >>> 1 단계 완료');

    // * 2. 염수 대피 [Step_2]
    // *  <test> SSC 비동기 처리 여부 >>> 결정지 염수 이동, 수중 태양광 증발지 그룹 2, 1 염수 이동, 일반 증발지 염수 이동 동시 실행 여부

    const ss_STEP_2 = mainScenarioStorage.getRunningScenario();
    const sc_STEP_2_LIST = ss_STEP_2.getRunningScenario();
    expect(sc_STEP_2_LIST).to.length(5);
    BU.CLI('???');
    // 아직 실행 전
    expect(_.filter(sc_STEP_2_LIST, sc => sc.isScenarioClear())).to.length(0);

    // *  >>> (5) [NEB_1_TO_SEA][COMPLETE]
    await eventToPromise(control, cmdStep.COMPLETE);
    BU.CLI('???');
    // *  <test> Goal 없는 Flow 명령 완료 시 삭제 여부
    expect(_.filter(sc_STEP_2_LIST, sc => sc.isScenarioClear())).to.length(1);

    // 주어진 지연 시간 이후로 완료되었다고 가정
    await Promise.delay(DPC_DELAY_MS);
    BU.CLI('???');
    // *  >>> [NCB_TO_BW_5][RUNNING], [SEB_TWO_TO_BW_3][RUNNING], [SEB_ONE_TO_BW_2][RUNNING], [NEB_2_TO_BW_1][RUNNING]
    expect(cmdManager.getCmdStorageList()).to.length(4);

    // 저수지
    const ps_NCB = placeManager.findPlace(pId.NCB);
    const pn_WL_NCB = ps_NCB.getPlaceNode(ndId.WL);
    // *  NCB_TO_BW_5 명령 Goal 인 NCB.WL = 1
    notifyDelayNodePlace([pn_WL_NCB, 1]);

    expect(cmdManager.getCmdStorage({ wrapCmdId: 'NCB_TO_BW_5' })).is.not.undefined;
    // >>> (1) [NCB_TO_BW_5][END],[
    await eventToPromise(control, cmdStep.END);
    BU.CLI('???');
    // *  <test> FLOW 명령. Single 설정 목표 달성으로 인한 ESC 명령 Stack 제거 및 Next ESC 명령 요청
    expect(cmdManager.getCmdStorage({ wrapCmdId: 'NCB_TO_BW_5' })).is.undefined;

    // *    목표 달성 >>> [NCB_TO_BW_5](R_CAN), [NCB_TO_SEA](R_CON) >>> [NCB_TO_SEA](DEL)
    // *  NCB_TO_SEA][COMPLETE]
    /** @type {CmdStorage} */
    const cs_NCB_TO_SEA = await eventToPromise(control, cmdStep.COMPLETE);
    expect(cs_NCB_TO_SEA.wrapCmdId).to.eq('NCB_TO_SEA');

    // 결정지 염수 이동 완료되었으므로 2개 완료
    expect(_.filter(sc_STEP_2_LIST, sc => sc.isScenarioClear())).to.length(2);

    // *  SEB_6.WL = 1, SEB_7.WL = 1, SEB_8.WL = 1 순차적으로 실행.
    const pn_SEB_6 = placeManager.findPlace(pId.SEB_6).getPlaceNode(ndId.WL);
    const pn_SEB_7 = placeManager.findPlace(pId.SEB_7).getPlaceNode(ndId.WL);
    const pn_SEB_8 = placeManager.findPlace(pId.SEB_8).getPlaceNode(ndId.WL);

    notifyDirectNodePlace([pn_SEB_6, 1], [pn_SEB_7, 1]);

    const cs_SEB_TWO_TO_BW_3 = cmdManager.getCmdStorage({
      srcPlaceId: pId.SEB_TWO,
      destPlaceId: pId.BW_3,
    });

    // 달성 목표가 SEB_6.WL, SEB_7.WL, SEB_8.WL 2cm 이하여야 되므로 실행중
    expect(cs_SEB_TWO_TO_BW_3.wrapCmdStep).to.eq(cmdStep.RUNNING);

    notifyDirectNodePlace([pn_SEB_8, 1]);
    // *  <test> Flow 명령. Multi 설정 목표 달성으로 인한 ESC 명령 Stack 제거 및 Next ESC 명령 요청
    // 달성 목표가 SEB_6.WL, SEB_7.WL, SEB_8.WL 2cm 이하여야 되므로 실행중
    // >>> (2) [SEB_TWO_TO_BW_3][END],
    expect(cs_SEB_TWO_TO_BW_3.wrapCmdStep).to.eq(cmdStep.END);

    // *  [SEB_TWO_TO_SEA][COMPLETE]
    await eventToPromise(control, cmdStep.COMPLETE);
    BU.CLI('???');
    // 수중 증발지 2그룹 이동 완료되었으므로 3개 완료
    expect(_.filter(sc_STEP_2_LIST, sc => sc.isScenarioClear())).to.length(3);

    // *  BW_2.WL = 150. 급수지 수위 최대치에 의한 명령 취소
    const pn_BW_2 = placeManager.findPlace(pId.BW_2).getPlaceNode(ndId.WL);
    BU.CLIN(pn_BW_2.getNodeValue());
    notifyDirectNodePlace([pn_BW_2, 150]);
    BU.CLIN(pn_BW_2.getNodeValue());
    // *  <test> Flow 명령. 급수지 수위 최대치에 의한 명령 취소 여부
    // *  >>> (3) [SEB_ONE_TO_BW_2][END],
    BU.CLI('???');
    await eventToPromise(control, cmdStep.END);
    BU.CLI('???');
    // [SEB_ONE_TO_SEA][COMPLETE]
    await eventToPromise(control, cmdStep.COMPLETE);
    BU.CLI('???');
    // 수중 증발지 1그룹 이동 완료되었으므로 4개 완료
    expect(_.filter(sc_STEP_2_LIST, sc => sc.isScenarioClear())).to.length(4);

    // *  NEB_2.WL = 1
    const pn_NEB_2 = placeManager.findPlace(pId.NEB_2).getPlaceNode(ndId.WL);

    // *    목표 달성 >>> [NEB_2_TO_BW_1](R_CAN)
    notifyDelayNodePlace([pn_NEB_2, 1]);

    // *  >>> (4) [NEB_2_TO_BW_1][END],
    await eventToPromise(control, cmdStep.END);
    BU.CLI('???');
    // [NEB_2_TO_SEA][COMPLETE]
    await eventToPromise(control, cmdStep.COMPLETE);

    BU.CLI('TC_1 >>> 2 단계 완료');

    // *  <test> [Step_2] All SSC 명령 완료 후 Next MSC 진행 여부
    // * 3. 바다로 ~ [Step_3]
    expect(mainScenarioStorage.executeIndex).to.eq(2);
    // *    'rainMode' Set 명령 실행 여부

    // *  >>> [SET_RAIN_MODE][COMPLETE]
    await eventToPromise(control, cmdStep.COMPLETE);

    // console.dir(scenarioManager.scenarioStorage);

    // BU.CLIN(scenarioManager.scenarioStorage, 3);
    BU.CLI('TC_1 >>> 3 단계 완료');
  });

  it.skip('시연 모드 1', async () => {
    const { cmdManager, placeManager, scenarioManager } = control.model;
    // 시나리오 입힘
    scenarioManager.scenarioCmdList = scenarioList;

    scenarioManager.initScenario({ wrapCmdId: 'normalFlowScenario' });

    const mainScenarioStorage = scenarioManager.scenarioStorage;
    // * 1. 'closeAllDevice' Set 명령 요청 [Step_1]
    // *  <test> Set 명령 정상적으로 수행 여부
    const sc_CLOSE_ALL_DEVICE = mainScenarioStorage.getRunningScenario();
    // BU.CLIN(sc_CLOSE_ALL_DEVICE);
    expect(sc_CLOSE_ALL_DEVICE.getWrapCmdId()).to.eq('closeAllDevice');

    // *  <test> MSC 동기 처리 여부 >>> 명령 수행 중 [Step_2]로 넘어가지 않는지 여부
    expect(mainScenarioStorage.executeIndex).to.eq(0);

    expect(sc_CLOSE_ALL_DEVICE.isScenarioClear()).to.false;

    // *  >>> [CLOSE_ALL_DEVICE][COMPLETE]
    /** @type {CmdStorage} */
    const cs_SET_CLOSE_ALL_DEVICE = await eventToPromise(control, cmdStep.COMPLETE);
    // 명령 종료됨.
    expect(sc_CLOSE_ALL_DEVICE.isScenarioClear()).to.true;

    expect(cs_SET_CLOSE_ALL_DEVICE.wrapCmdId).to.equal('closeAllDevice');
    // *  <test> Goal이 없는 명령일 경우 장치 제어 완료 후 명령 Stack에서 제거 여부
    expect(mainScenarioStorage.executeIndex).to.eq(1);

    BU.CLI('TC_1 >>> 1 단계 완료');

    const ss_STEP_2 = mainScenarioStorage.getRunningScenario();
  });
});
