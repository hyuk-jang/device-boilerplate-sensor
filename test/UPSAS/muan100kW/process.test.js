/* eslint-disable camelcase */
require('dotenv').config();
const _ = require('lodash');
const { expect } = require('chai');

const eventToPromise = require('event-to-promise');

const { BU } = require('base-util-jh');
const config = require('./config');
const Main = require('../../../src/Main');
const CoreFacade = require('../../../src/core/CoreFacade');

const { dcmConfigModel } = CoreFacade;

const {
  commandStep: cmdStep,
  goalDataRange: goalDR,
  reqWrapCmdType: reqWCT,
  reqWrapCmdFormat: reqWCF,
  reqDeviceControlType: { TRUE, FALSE, SET, MEASURE },
} = dcmConfigModel;

const Timeout = setTimeout(function() {}, 0).constructor;

process.env.NODE_ENV = 'development';

const { dbInfo } = config;

const main = new Main();
// const control = main.createControl({
//   dbInfo: config.dbInfo,
// });
const control = main.createControl(config);
const coreFacade = new CoreFacade();

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

const notifyDelayNode = updateNode(control);
const notifyDirectNode = updateNode(control, false);
const notifyDelayNodePlace = updatePlace(control);
const notifyDirectNodePlace = updatePlace(control, false);

/** SingleControlValue 검색 형식 */

describe('수위 임계치 처리 테스트', function() {
  this.timeout(10000);

  before(async () => {
    await control.init(dbInfo, config.uuid);
    control.runFeature();

    const cmdStorage = control.inquiryAllDeviceStatus();
    // BU.CLIN(cmdStorage)

    await eventToPromise(control, cmdStep.COMPLETE);

    // const simpleNodeList = _.map(control.nodeList, nodeInfo => {
    //   const { node_id, data } = nodeInfo;
    //   return { node_id, data };
    // });

    // BU.CLI(simpleNodeList);

    // BU.CLIN(control.nodeList);
  });

  beforeEach(async () => {
    try {
      coreFacade.updateControlMode(controlMode.MANUAL);
      control.executeSetControl({
        wrapCmdId: 'closeAllDevice',
        wrapCmdType: reqWCT.CONTROL,
      });

      await eventToPromise(control, cmdStep.COMPLETE);
    } catch (error) {
      BU.error(error.message);
    }

    // 이전 명령이 남아있을 수 있으므로 강제 초기화
    coreFacade.cmdManager.commandList = [];
    coreFacade.updateControlMode(controlMode.POWER_OPTIMIZATION);
  });

  /**
   * @desc T.C 1
   * 자동 염수 이동 명령이 없는 장소에 일반 염수 이동 명령을 내릴 경우
   * 배수지 수위 최저치(Min) 및 급수지 수위 최대치(Max)에 의해 명령 취소 테스트
   * @tutorial
   * 1. 결정지의 수위를 Max값(15cm)으로 설정하고 해주 5의 수위를 Min값(10cm)으로 설정
   *  <test> 배수지의 수위 최저치 이하 또는 급수지의 수위 최대치 이상일 경우 염수 이동 불가
   *      명령 요청 >>> [BW_5_TO_NCB](R_CON){Expect Fail}
   * 2. 해주 5의 수위를 정상 (130cm) 설정
   *  <test> 급수지(결정지)의 수위가 최대치 이상일 경우 명령 불가
   *      명령 요청 >>> [BW_5_TO_NCB](R_CON){Expect Fail}
   * 3. 결정지의 수위를 Set값(5cm) 설정
   *  <test> 배수지의 수위 정상 값, 급수지의 수위 정상값 일 경우 염수 이동 가능
   *      명령 요청 >>> [BW_5_TO_NCB](R_CON->C_CON){Expect Success}
   * 4. 결정지의 수위를 Max값 이상(15cm) 설정.
   *  <test> 급수지의 수위 최대치에 의한 명령 취소
   *      급수지 수위 최대치 >>> [BW_5_TO_NCB](R_CAN)
   *    결정지의 수위를 Set값(5cm) 설정.
   *      명령 요청 >>> [BW_5_TO_NCB](R_CON->C_CON) :: 달성 목표: 급수지(결정지) 수위 10cm 이상, 달성 제한 시간: 2 Sec
   * 5. 해주 5의 수위를 Min(10cm) 설정. [해주 5 > 결정지 ] 진행 중 명령 삭제 및 임계 명령 삭제 확인
   *  <test> 배수지의 수위 최저치에 의한 명령 취소
   *      배수지 수위 최저치 >>> [BW_5_TO_NCB](R_CAN)
   *  <test> 장소 임계치에 의한 명령 삭제 시 임계 명령 삭제 확인
   */
  it('급배수지 수위 최저, 최대치에 의한 명령 처리', async () => {
    const { cmdManager, placeManager } = control.model;

    // 저수지
    const ps_BW_5 = placeManager.findPlace(pId.BW_5);
    const pn_WL_BW_5 = ps_BW_5.getPlaceNode(ndId.WL);
    // 일반 증발지 1
    const ps_NCB = placeManager.findPlace(pId.NCB);
    const pn_WL_NCB = ps_NCB.getPlaceNode(ndId.WL);

    // * 1. 결정지의 수위를 Max값(15cm)으로 설정하고 해주 5의 수위를 Min값(10cm)으로 설정
    notifyDirectNodePlace([pn_WL_NCB, 15], [pn_WL_BW_5, 10]);

    /** @type {reqFlowCmdInfo} 해주 5 >>> 결정지 */
    const BW5_TO_NCB = {
      srcPlaceId: ps_BW_5.getPlaceId(),
      destPlaceId: ps_NCB.getPlaceId(),
      wrapCmdType: reqWCT.CONTROL,
    };

    // *  <test> 배수지의 수위 최저치 이하 또는 급수지의 수위 최대치 이상일 경우 염수 이동 불가
    // *    명령 요청 >>> [BW_5_TO_NCB](R_CON){Expect Fail}
    expect(() => control.executeFlowControl(BW5_TO_NCB)).to.throw(
      'The water level of the srcPlaceId: BW_5 is below the minimum water level',
    );

    BU.CLI('TC_1 >>> 1 단계 완료');

    // * 2. 해주 5의 수위를 정상 (130cm) 설정
    notifyDirectNodePlace([pn_WL_BW_5, 130]);

    // *  <test> 급수지(결정지)의 수위가 최대치 이상일 경우 명령 불가
    // *      명령 요청 >>> [BW_5_TO_NCB](R_CON){Expect Fail}
    expect(() => control.executeFlowControl(BW5_TO_NCB)).to.throw(
      'The water level of the destPlaceId: NCB is over the max water level.',
    );

    BU.CLI('TC_1 >>> 2 단계 완료');

    // * 3. 결정지의 수위를 Set값(5cm) 설정
    notifyDirectNodePlace([pn_WL_NCB, 5]);

    // *  <test> 배수지의 수위 정상 값, 급수지의 수위 정상값 일 경우 염수 이동 가능
    // *    명령 요청 >>> [BW_5_TO_NCB](R_CON->C_CON){Expect Success}
    const cs_BW_5_To_NCB = control.executeFlowControl(BW5_TO_NCB);

    /** @type {CmdStorage} */
    const BW_5_To_NCB_WC_CONTROL = await eventToPromise(control, cmdStep.COMPLETE);

    // * REAL_TRUE: ['P_013'], IGNORE_TRUE: []
    expect(getNodeIds(cs_BW_5_To_NCB, sConV.REAL_TRUE)).to.deep.equal(['P_013']);
    // * REAL_FALSE: [], IGNORE_FALSE: ['WD_007','WD_008']
    expect(getNodeIds(BW_5_To_NCB_WC_CONTROL, sConV.IGNORE_FALSE)).to.deep.equal([
      'WD_007',
      'WD_008',
    ]);

    BU.CLI('TC_1 >>> 3 단계 완료');

    // * 4. 결정지의 수위를 Max값 이상(15cm) 설정.
    notifyDirectNodePlace([pn_WL_NCB, 15]);
    // *  <test> 급수지의 수위 최대치에 의한 명령 취소
    // *    급수지 수위 최대치 >>> [BW_5_TO_NCB](R_CAN)

    // 복원 단계 대기
    // await eventToPromise(control, cmdStep.RESTORE);
    // // 아직 복원 명령 전이므로 * REAL_TRUE: [], IGNORE_TRUE: []
    // expect(getNodeIds(cs_BW_5_To_NCB, sConV.REAL_TRUE)).to.deep.equal([]);
    // // * REAL_FALSE: ['P_013], IGNORE_FALSE: []
    // expect(getNodeIds(BW_5_To_NCB_WC_CONTROL, sConV.REAL_FALSE)).to.deep.equal(['P_013']);

    // 종료 단계 대기
    await eventToPromise(control, cmdStep.END);
    // 수위 갱신을 한번 더 했을 경우 이미 취소 명령을 실행 중이므로 아무런 일도 일어나지 않음.
    notifyDirectNodePlace([pn_WL_NCB, 15]);

    expect(cmdManager.commandList).to.length(0);

    // *    결정지의 수위를 Set값(5cm) 설정.
    notifyDirectNodePlace([pn_WL_NCB, 5]);

    BW5_TO_NCB.wrapCmdGoalInfo = {
      limitTimeSec: 2,
      goalDataList: [
        {
          nodeId: pn_WL_NCB.getNodeId(),
          goalValue: 10,
          goalRange: goalDR.UPPER,
        },
      ],
    };
    // *      명령 요청 >>> [BW_5_TO_NCB](R_CON->C_CON) :: 달성 목표: 급수지(결정지) 수위 10cm 이상, 달성 제한 시간: 2 Sec
    const cs_BW5_TO_NCB = control.executeFlowControl(BW5_TO_NCB);

    // 달성 목표가 있기 때문에 진행 단계 대기
    await eventToPromise(control, cmdStep.RUNNING);

    // 임계 명령이 존재해야 한다.
    expect(cs_BW5_TO_NCB.thresholdStorage).is.not.empty;
    expect(cs_BW5_TO_NCB.thresholdStorage.threCmdGoalList).to.length(1);

    BU.CLI('TC_1 >>> 4 단계 완료');

    const nodeUpdator_NODE_WL = control.nodeUpdatorManager.getNodeUpdator('WL_017');
    // expect(nodeUpdator_NODE_WL.getObserver(threGoal_NODE_WL)).to.eq(threGoal_NODE_WL);
    // PlaceNode, ThreGoal
    expect(nodeUpdator_NODE_WL.observers).to.length(2);

    // * 5. 해주 5의 수위를 Min(10cm) 설정. [해주 5 > 결정지 ] 진행 중 명령 삭제 및 임계 명령 삭제 확인
    notifyDirectNodePlace([pn_WL_BW_5, 10]);

    // *  <test> 배수지의 수위 최저치에 의한 명령 취소
    await eventToPromise(control, cmdStep.END);

    expect(cmdManager.commandList).to.length(0);
    // 임계 저장소 삭제 처리
    expect(cs_BW5_TO_NCB.thresholdStorage).to.undefined;
    // 임계 옵저버는 삭제 처리 됨. PlaceNode
    expect(nodeUpdator_NODE_WL.observers).to.length(1);

    BU.CLI('TC_1 >>> 5 단계 완료');
  });

  /**
   * @desc T.C 2
   * 자동 염수 이동 명령이 존재하는 장소에 일반 배수 명령을 내리고
   * 해당 장소(배수지)의 염수가 최저 수위에 도달할 경우
   * 기존 배수 명령을 취소하고 해당 장소의 우선 급수 순위에 따라 자동 급수 명령 테스트
   * @description
   * 장소 임계치에 의한 흐름 명령 생성은 무조건 Goal이 존재
   * Goal이 존재할 경우 [최대치, 최저치]에 명령 생성 및 취소
   * Goal이 존재하지 않을 경우 [최대치, 하한선, 최저치]에 명령 생성 및 취소
   * @tutorial
   * 1. 일반 증발지 1 에서 일반 증발지 2로 염수 이동
   *     달성 목표:
   *        배수지(일반 증발지 1) 수위 Min(2) < 4 < LowerLimitUnder(6),
   *        급수지(일반 증발지 2) 수위 UpperLimitOver(15) < 18 < Max(20)
   *      명령 요청 >>> [NEB_1_TO_NEB_2](R_CON) {GT= NEB_1.WL: 4, NEB_2.WL: 18}
   *  >>> [NEB_1_TO_NEB_2][RUNNING]
   * 2. 급수지(일반 증발지 2)의 수위를 GT와 ULO 사이인 16으로 변경.
   *  <test> 목표가 있는 명령이라면 수위 상한선에 걸리려도 명령 속행
   *  BW_1.WL = 20, BW_1.S = 3, NEB_2.WL = 18 (상한선 초과). 목표 달성으로 인한 명령 취소
   *      급수지 목표 달성 >>> [NEB_1_TO_NEB_2](R_CAN)
   *  >>> [NEB_1_TO_NEB_2][END]
   *  <test> 수위 상한선에 의한 자동 배수 (설정 수위 복원)  :: 달성 목표: 배수지(일반 증발지 2) 수위 12cm 이하
   *      일반 증발지 2 수위 상한선 >>> [NEB_2_TO_BW_1](R_CON)
   *  >>> [NEB_2_TO_BW_1][RUNNING]
   * 3. NEB_2.WL = 10 교체 후 1번 재요청
   *      목표 달성 >>> [NEB_2_TO_BW_1](R_CAN)
   *  >>> [NEB_2_TO_BW_1][END]
   *      명령 요청 >>> [NEB_1_TO_NEB_2](R_CON) {GT= NEB_1.WL: 4, NEB_2.WL: 18}
   *  >>> [NEB_1_TO_NEB_2][RUNNING]
   * 4. NEB_1.WL = 5, 일반 증발지 1의 수위를 GT와 LLU 사이인 5로 변경.
   *  <test> 급수지로의 목표가 있는 명령이고 현재 그 명령을 달성하지 못했다면 하한선 무시
   *  >>> [NEB_1_TO_NEB_2][RUNNING]
   * 5. NEB_1.WL = 0 (최저치)
   *  <test> 장소 임계치와 목표달성 임계치가 동시에 만족할 경우 명령 취소는 1번이 정상적으로 처리
   *      배수지 수위 최저치 >>> [NEB_1_TO_NEB_2](R_CAN)
   *  >>> [NEB_1_TO_NEB_2][END]
   *  <test> 수위 하한선에 의한 자동 급수 요청
   *      일반 증발지 1 수위 하한선 >>> [RV_TO_NEB_1](R_CON) :: 달성 목표: 급수지(일반 증발지 1) 수위 10cm 이상
   *  >>> [RV_TO_NEB_1][RUNNING]
   * 6. BW_1.WL = 10(최저치), NEB_2.WL = 4(하한선)
   *  <test> 수위 하한선에 의한 배수지 탐색 시 모든 배수지가 수위 최저치 이하라면 1순위 배수지에 급수 요청
   *      일반 증발지 2 수위 하한선 >>> 배수지 수위 부족으로 인한 실패
   *  >>> [RV_TO_NEB_1][RUNNING]
   * 7. NEB_1.WL = 11 (Normal) 설정, 일반 증발지 2 수위 갱신
   *    목표 달성 >>> [RV_TO_NEB_1](R_CAN)
   *  >>> [RV_TO_NEB_1][END]
   *  <test> 자동 급수 요청 우선 순위에 따라 급수 대상 탐색. 1순위(해주 1) 자격 미달에 의한 2순위 지역 급수 요청
   *      수위 하한선 >>> [NEB_1_TO_NEB_2](R_CON) :: 달성 목표: 급수지(일반 증발지 2) 수위 12cm 이상
   *  >>> [NEB_1_TO_NEB_2][RUNNING]
   */
  it('수위 임계치에 의한 우선 순위 염수 이동 명령 자동 생성 및 취소', async () => {
    const { cmdManager, placeManager } = control.model;

    const getFlowCmd = (srcPlaceId, destPlaceId) => {
      return cmdManager.getCmdStorage({
        srcPlaceId,
        destPlaceId,
      });
      // return cmdManager.getFlowCommand(srcPlaceId, destPlaceId);
    };

    // 저수지
    const ps_RV_1 = placeManager.findPlace(pId.RV_1);
    const pn_WL_RV_1 = ps_RV_1.getPlaceNode(ndId.WL);
    // 일반 증발지 1
    const ps_NEB_1 = placeManager.findPlace(pId.NEB_1);
    const pn_WL_NEB_1 = ps_NEB_1.getPlaceNode(ndId.WL);
    pn_WL_NEB_1.upperLimitValue = {
      value: 15,
      isCall: false,
    };
    pn_WL_NEB_1.setValue = {
      value: 10,
    };
    pn_WL_NEB_1.lowerLimitValue = {
      value: 5,
      isCall: true,
    };
    pn_WL_NEB_1.minValue = {
      value: 2,
      isCall: true,
    };
    // pn_WL_NEB_1.lowerLimitValue = {
    //   value: 6,
    //   isCall: true,
    // };
    // 일반 증발지 2
    const ps_NEB_2 = placeManager.findPlace(pId.NEB_2);
    const pn_WL_NEB_2 = ps_NEB_2.getPlaceNode(ndId.WL);
    const pn_S_NEB_2 = ps_NEB_2.getPlaceNode(ndId.S);
    pn_WL_NEB_2.upperLimitValue = {
      value: 15,
      isCall: false,
    };
    pn_WL_NEB_2.setValue = {
      value: 10,
    };
    pn_WL_NEB_2.lowerLimitValue = {
      value: 5,
      isCall: true,
    };
    pn_WL_NEB_2.minValue = {
      value: 2,
      isCall: true,
    };
    // 해주 1
    const ps_BW_1 = placeManager.findPlace(pId.BW_1);
    const pn_WL_BW_1 = ps_BW_1.getPlaceNode(ndId.WL);
    // 해주 2
    const ps_BW_2 = placeManager.findPlace(pId.BW_2);
    const pn_WL_BW_2 = ps_BW_2.getPlaceNode(ndId.WL);

    //  * 1. 일반 증발지 1 에서 일반 증발지 2로 염수 이동
    //  *     달성 목표:
    //  *        배수지(일반 증발지 1) 수위 Min(2) < 4 < LowerLimitUnder(6),
    //  *        급수지(일반 증발지 2) 수위 UpperLimitOver(15) < 18 < Max(20)

    /** @type {reqFlowCmdInfo} */
    const NEB_1_TO_NEB_2 = {
      srcPlaceId: pId.NEB_1,
      destPlaceId: pId.NEB_2,
      wrapCmdType: reqWCT.CONTROL,
      wrapCmdGoalInfo: {
        goalDataList: [
          {
            nodeId: pn_WL_NEB_1.getNodeId(),
            goalValue: 4,
            goalRange: goalDR.LOWER,
            isCompleteClear: true,
          },
          {
            nodeId: pn_WL_NEB_2.getNodeId(),
            goalValue: 18,
            goalRange: goalDR.UPPER,
            isCompleteClear: true,
          },
        ],
      },
    };
    //  *    명령 요청 >>> [NEB_1_TO_NEB_2](R_CON) {GT= NEB_1.WL: 4, NEB_2.WL: 18}
    let cs_NEB_1_TO_NEB_2 = control.executeFlowControl(NEB_1_TO_NEB_2);

    await eventToPromise(control, cmdStep.RUNNING);

    expect(cs_NEB_1_TO_NEB_2).to.include({ srcPlaceId: pId.NEB_1, destPlaceId: pId.NEB_2 });
    // [NEB_1_TO_NEB_2]
    expect(cmdManager.commandList).to.length(1);

    BU.CLI('TC_2 >>> 1 단계 완료');

    //  * 2. 급수지(일반 증발지 2)의 수위를 GT와 ULO 사이인 16으로 변경.
    notifyDirectNodePlace([pn_WL_NEB_2, 16]);

    //  *  <test> 목표가 있는 명령이라면 수위 상한선에 걸려도 명령 속행
    expect(getFlowCmd(pId.NEB_1, pId.NEB_2).wrapCmdType).to.eq(reqWCT.CONTROL);

    expect(
      cmdManager.getCmdEleList({
        singleControlType: TRUE,
      }),
    ).to.length(2);

    expect(
      cmdManager.getCmdEleList({
        singleControlType: FALSE,
      }),
    ).to.length(4);

    // 목표 달성 >>> 명령 취소
    // *  BW_1.WL = 20, BW_1.S = 3, NEB_2.WL = 18. 목표 달성으로 인한 명령 취소
    notifyDirectNodePlace([pn_WL_BW_1, 20], [pn_S_NEB_2, 2], [pn_WL_NEB_2, 19]);
    // 일반 증발지 1 >>> 일반 증발지 2 의 염수 이동 임계치 목표 달성 완료

    expect(coreFacade.getCurrCmdStrategyType()).to.eq(coreFacade.cmdStrategyType.OVERLAP_COUNT);

    //  *    급수지 목표 달성 >>> [NEB_1_TO_NEB_2](R_CAN)
    // *  >>> [NEB_1_TO_NEB_2][END]
    await eventToPromise(control, cmdStep.END);

    // *  <test> 수위 상한선에 의한 자동 배수 (설정 수위 복원)  :: 달성 목표: 배수지(일반 증발지 2) 수위 12cm 이하
    // *    일반 증발지 2 수위 상한선 >>> [NEB_2_TO_BW_1](R_CON)
    /** @type {CmdStorage} */
    const cs_NEB_2_TO_BW_1 = await eventToPromise(control, cmdStep.RUNNING);
    expect(cmdManager.commandList).to.length(1);

    // * REAL_TRUE: ['WD_005'], IGNORE_TRUE: []
    expect(getNodeIds(cs_NEB_2_TO_BW_1, sConV.REAL_TRUE)).to.deep.equal(['WD_005']);
    // * REAL_FALSE: [], IGNORE_FALSE: ['WD_004','WD_006']
    expect(getNodeIds(cs_NEB_2_TO_BW_1, sConV.IGNORE_FALSE)).to.deep.equal(['WD_004', 'WD_006']);

    // *  >>> [NEB_2_TO_BW_1][RUNNING]
    BU.CLI('TC_2 >>> 2 단계 완료');

    // * 3. BW_1.WL = 20, NEB_2.WL = 10 교체 후 1번 재요청
    notifyDirectNodePlace([pn_WL_NEB_2, 10]);
    // *    목표 달성 >>> [NEB_2_TO_BW_1](R_CAN)
    // const cs_can_NEB_2_TO_BW_1 = await eventToPromise(control, cmdStep.CANCELING);
    // *  >>> [NEB_2_TO_BW_1][END]
    await eventToPromise(control, cmdStep.END);

    // *    명령 요청 >>> [NEB_1_TO_NEB_2](R_CON) {GT= NEB_1.WL: 4, NEB_2.WL: 18}
    control.executeFlowControl(NEB_1_TO_NEB_2);
    // *  >>> [NEB_1_TO_NEB_2][RUNNING]
    cs_NEB_1_TO_NEB_2 = await eventToPromise(control, cmdStep.RUNNING);

    BU.CLI('TC_2 >>> 3 단계 완료');

    // * 4. NEB_1.WL = 5, 일반 증발지 1의 수위를 GT와 LLU 사이인 5로 변경.
    // *  >>> [NEB_1_TO_NEB_2][RUNNING]
    notifyDirectNodePlace([pn_WL_NEB_1, 5]);
    // *  <test> 급수지로의 목표가 있는 명령이고 현재 그 명령을 달성하지 못했다면 하한선 무시
    // 여전히 명령은 실행 중

    expect(getFlowCmd(pId.NEB_1, pId.NEB_2).wrapCmdType).to.eq(reqWCT.CONTROL);

    BU.CLI('TC_2 >>> 4 단계 완료');

    // * 5. NEB_1.WL = 0 (최저치)
    // [NEB_1_TO_NEB_2](R_CAN)
    notifyDirectNodePlace([pn_WL_NEB_1, 0]);
    // *  <test> 장소 임계치와 목표달성 임계치가 동시에 만족할 경우 명령 취소는 1번이 정상적으로 처리
    // *    배수지 수위 최저치 >>> [NEB_1_TO_NEB_2](R_CAN)
    expect(getFlowCmd(pId.NEB_1, pId.NEB_2).wrapCmdType).to.eq(reqWCT.CANCEL);

    // *  >>> [NEB_1_TO_NEB_2][END]
    await eventToPromise(control, cmdStep.END);

    // *  <test> 수위 하한선에 의한 자동 급수 요청
    // *    일반 증발지 1 수위 하한선 >>> [RV_TO_NEB_1](R_CON) :: 달성 목표: 급수지(일반 증발지 1) 수위 10cm 이상
    // *  >>> [RV_TO_NEB_1][RUNNING]
    /** @type {CmdStorage} */
    const cs_RV_TO_NEB_1 = await eventToPromise(control, cmdStep.RUNNING);
    expect(getFlowCmd(pId.RV_1, pId.NEB_1).wrapCmdType).to.eq(reqWCT.CONTROL);

    BU.CLI('TC_2 >>> 5 단계 완료');

    // * 6. 해주 수위 최저치 10cm 변경, 일반 증발지 2 하한선 수위 4cm 변경
    // *  <test> 수위 하한선에 의한 배수지 탐색 시 모든 배수지가 수위 최저치 이하라면 1순위 배수지에 급수 요청
    // control.notifyDeviceData(null, [setNodeData(pn_WL_BW_1, 10)]);

    // *  >>> [RV_TO_NEB_1][RUNNING]
    notifyDirectNodePlace([pn_WL_BW_1, 10], [pn_WL_NEB_2, 4]);

    BU.CLI('TC_2 >>> 6 단계 완료');

    // *    일반 증발지 2 수위 하한선 >>> 배수지 수위 부족으로 인한 실패
    // * 7. NEB_1.WL = 11 (Normal) 설정, 일반 증발지 2 수위 갱신
    control.notifyDeviceData(null, [setNodeData(pn_WL_NEB_1, 10)]);
    control.notifyDeviceData(null, [setNodeData(pn_WL_NEB_2, 4)]);
    // *    목표 달성 >>> [RV_TO_NEB_1](R_CAN)
    expect(getFlowCmd(pId.RV_1, pId.NEB_1).wrapCmdType).to.eq(reqWCT.CANCEL);

    // *  >>> [RV_TO_NEB_1][END]
    await eventToPromise(control, cmdStep.END);

    // 일반 증발지 수위 갱신
    notifyDirectNodePlace([pn_WL_NEB_2, 2]);

    // *  <test> 자동 급수 요청 우선 순위에 따라 급수 대상 탐색. 1순위(해주 1) 자격 미달에 의한 2순위 지역 급수 요청
    // *    수위 하한선 >>> [NEB_1_TO_NEB_2](R_CON) :: 달성 목표: 급수지(일반 증발지 2) 수위 12cm 이상
    cs_NEB_1_TO_NEB_2 = await eventToPromise(control, cmdStep.RUNNING);

    expect(getFlowCmd(pId.NEB_1, pId.NEB_2).wrapCmdType).to.eq(reqWCT.CONTROL);

    BU.CLI('TC_2 >>> 7 단계 완료');
  });

  /**
   * @desc T.C 3
   * 급수지에서 염수를 받을 배수지가 동시에 다수인 경우 다수 명령 생성
   * 급수지에서 염수를 수급받을 배수지 모두가 염수가 최저치일 경우 배수지에 채우는 명령(멀티)
   * @description
   *      해주 1 BW_WV: 12m * 3m * 1.5m = 54 m3, 0.1m 당 3.6 m3
   *      해주 2 BW_WV: 9m * 3m * 1.5m = 40.5 m3, 0.1m 당 2.7 m3
   *      해주 3, 4 BW_WV: 4m * 3m * 1.5m = 18 m3, 0.1m 당 1.2 m3
   *      수중태양광 증발지 SEB_WV: 3.56m * 28m * 0.15m = 14.95 m3 = 15 m3, 0.01 m 당 1 m3
   * @tutorial
   * 1. NEB_2의 급수 순위를 [BW_1,NEB_1]에서 [[BW_1,NEB_1]]로 변경
   *    NEB_2.callPlaceRankList = [[BW_1,NEB_1]]
   *    BW_3.callPlaceRankList = [[SEB_1,SEB_2,SEB_3,SEB_4,SEB_5]], BW_2.callPlaceRankList = [NEB_2]
   *  NEB_2.WL = 3 (하한선)
   *  <test> 동시 다중 배수지일경우 동시 수행 테스트
   *    일반 증발지 2 수위 하한선 >>> [BW_1_TO_NEB_2,NEB_1_TO_NEB_2](R_CON)
   *  >>> [BW_1_TO_NEB_2][RUNNING], [NEB_1_TO_NEB_2][RUNNING]
   * 2. NEB_2.WL = 10 (Normal)
   *  <test> 동시 명령 중 목표 완료 시 동시 종료 테스트
   *    일반 증발지 2 목표 달성 >>> [BW_1_TO_NEB_2,NEB_1_TO_NEB_2](R_CAN)
   *  >>> [BW_1_TO_NEB_2][END], [NEB_1_TO_NEB_2][END]
   * 3. BW_3.WL = 20,  SEB_6.WL = 2 (하한선)
   *  <test> 급수지에 염수를 (하한선 + (Set - 하한선)/2) 공급할 수 없을 경우
   *          급수지와 동일하지 않은 1순위 배수지로 염수 이동 요청(멀티)
   *    BW_3.AbleWV: 1.2 m3, SEB_6.WV: (3 + (5-3)/2) - 2 = 2 m3
   *    SEB_6.WL 하한선 > BW_3.WL 염수 이동 조건 불가 > [SEB_1,SEB_2,SEB_3,SEB_4,SEB_5][TO_BW_3](R_CON)
   * 급수 강제 이동은 Goal이 없기 때문에 명령 단계: Complete
   *  >>> [SEB_1_TO_BW_3][COMPLETE], [SEB_2_TO_BW_3][COMPLETE], [SEB_3_TO_BW_3][COMPLETE]
   *  >>> [SEB_4_TO_BW_3][COMPLETE], [SEB_5_TO_BW_3][COMPLETE],
   * 4. BW_2.WL = 20, SEB_1.WL = 0, SEB_2.WL = 0,
   *  <test> 동시 명령 중 목표 달성 시 개별 취소
   *    SEB_1.WL, SEB_2.WL 수위 최저치로 인한 명령 취소
   *  >>> [SEB_1_TO_BW_3][END], [SEB_2_TO_BW_3][END], [SEB_3_TO_BW_3][COMPLETE]
   *  >>> [SEB_4_TO_BW_3][COMPLETE], [SEB_5_TO_BW_3][COMPLETE],
   *  <test> DP 염수 부족으로 인한 BP(단일) 강제 급수 진행
   *    BW_2.WL: 20, BW_2.Able_WV: (20-10) * 0.27 = 2.7 m3, SEB_1.Need_WV: (3 + (5-3)/2) = 4 m3
   *    BW_2.Able_WV(2.7) < SEB_1.Need_WV(4) 이므로 DP 강제 급수 진행
   *      강제 요청 >>> [NEB_2_TO_BW_2](R_CON), 강제 급수이므로 목표치 없음
   *       2번 요청 일어나나 1번은 무시
   *  >>> [SEB_3_TO_BW_3][COMPLETE], [SEB_4_TO_BW_3][COMPLETE], [SEB_5_TO_BW_3][COMPLETE],
   *  >>> [NEB_2_TO_BW_2][COMPLETE]
   * 5. BW_2.WL = 30, SEB_1.WL = 0, SEB_2.WL = 0,
   *  <test> 급수 요건 고려 시 개별적으로 고려.
   *    SEB_1.Need_WV: 4, SEB_2.Need_WV: 4, BW_2.Able_WV: (30-10) * 0.27 = 5.4 m3,
   *    합산 처리하면 불가능하나 개별적으로 보면 4 < 5.7 이므로 염수 이동
   *  >>> [SEB_3_TO_BW_3][COMPLETE], [SEB_4_TO_BW_3][COMPLETE], [SEB_5_TO_BW_3][COMPLETE],
   *  >>> [NEB_2_TO_BW_2][COMPLETE],
   *  >>> [BW_2_TO_SEB_1][RUNNING], [BW_2_TO_SEB_2][RUNNING]
   *
   */
  it('염수 그룹화 이동', async () => {
    const { cmdManager, placeManager } = control.model;

    // * 1. 일반 증발지 2의 급수 순위를 [BW_1,NEB_1]에서 [[BW_1,NEB_1]]로 변경
    // 해주 1
    const ps_BW_1 = placeManager.findPlace(pId.BW_1);
    const pn_WL_BW_1 = ps_BW_1.getPlaceNode(ndId.WL);
    // 해주 2
    const ps_BW_2 = placeManager.findPlace(pId.BW_2);
    const pn_WL_BW_2 = ps_BW_2.getPlaceNode(ndId.WL);
    // BW_2.callPlaceRankList = [NEB_2]
    pn_WL_BW_2.callPlaceRankList = [pId.NEB_2];
    // 해주 3
    const ps_BW_3 = placeManager.findPlace(pId.BW_3);
    const pn_WL_BW_3 = ps_BW_3.getPlaceNode(ndId.WL);
    // 하한선은 없앰
    pn_WL_BW_3.lowerLimitValue = '';
    // * BW_3.callPlaceRankList = [[SEB_1,SEB_2,SEB_3,SEB_4,SEB_5]]
    pn_WL_BW_3.callPlaceRankList = [[pId.SEB_1, pId.SEB_2, pId.SEB_3, pId.SEB_4, pId.SEB_5]];
    // 일반 증발지 2
    const ps_NEB_2 = placeManager.findPlace(pId.NEB_2);
    const pn_WL_NEB_2 = ps_NEB_2.getPlaceNode(ndId.WL);
    // * NEB_2.callPlaceRankList = [[BW_1,NEB_1]]
    // 일반 증발지 수위 상한선 = 15cm
    pn_WL_NEB_2.upperLimitValue = {
      value: 15,
      isCall: false,
    };
    pn_WL_NEB_2.callPlaceRankList = [[pId.BW_1, pId.NEB_1]];
    const pn_S_NEB_2 = ps_NEB_2.getPlaceNode(ndId.S);
    // 수중 증발지 1
    const ps_SEB_1 = placeManager.findPlace(pId.SEB_1);
    const pn_WL_SEB_1 = ps_SEB_1.getPlaceNode(ndId.WL);
    // 수중 증발지 2
    const ps_SEB_2 = placeManager.findPlace(pId.SEB_2);
    const pn_WL_SEB_2 = ps_SEB_2.getPlaceNode(ndId.WL);
    // 수중 증발지 6
    const ps_SEB_6 = placeManager.findPlace(pId.SEB_6);
    const pn_WL_SEB_6 = ps_SEB_6.getPlaceNode(ndId.WL);
    const pn_S_SEB_6 = ps_SEB_6.getPlaceNode(ndId.S);

    expect(cmdManager.getCmdStorageList()).to.length(0);

    // *  NEB_2.WL = 3 (하한선)
    // *  <test> 동시 다중 배수지일경우 동시 수행 테스트
    notifyDirectNodePlace([pn_WL_BW_1, 100], [pn_WL_NEB_2, 3]);

    // *    일반 증발지 2 수위 하한선 >>> [BW_1_TO_NEB_2,NEB_1_TO_NEB_2](R_CON)
    // *  >>> [BW_1_TO_NEB_2][RUNNING], [NEB_1_TO_NEB_2][RUNNING]
    /** @type {CmdStorage} */
    const cs_BW_1_TO_NEB_2 = await eventToPromise(control, cmdStep.RUNNING);
    /** @type {CmdStorage} */
    const cs_NEB_1_TO_NEB_2 = await eventToPromise(control, cmdStep.RUNNING);

    // BU.CLIN(cmdManager.complexCmdList)
    expect(cmdManager.getCmdStorageList()).to.length(2);

    BU.CLI('TC_3 >>> 1 단계 완료');

    // * 2. NEB_2.WL = 10 (Normal)
    // *  <test> 동시 명령 중 목표 완료 시 동시 종료 테스트
    notifyDirectNodePlace([pn_WL_NEB_2, 12]);

    // *    일반 증발지 2 목표 달성 >>> [BW_1_TO_NEB_2,NEB_1_TO_NEB_2](R_CAN)
    // *  >>> [BW_1_TO_NEB_2][END], [NEB_1_TO_NEB_2][END]
    await eventToPromise(control, cmdStep.END);
    await eventToPromise(control, cmdStep.END);

    expect(cmdManager.getCmdStorageList()).to.length(0);

    BU.CLI('TC_3 >>> 2 단계 완료');

    // * 3. BW_3.WL = 10 (최저치) SEB_6.WL = 2 (하한선)
    // *  <test> 급수지에 염수를 (하한선 + (Set - 하한선)/2) 공급할 수 없을 경우
    // *          급수지와 동일하지 않은 1순위 배수지로 염수 이동 요청(멀티)
    notifyDirectNodePlace([pn_WL_BW_3, 20], [pn_WL_SEB_6, 2]);

    // *    SEB_6.WL 하한선 > BW_3.WL 염수 이동 조건 불가 > [SEB_1,SEB_2,SEB_3,SEB_4,SEB_5][TO_BW_3](R_CON)
    // * 급수 강제 이동은 Goal이 없기 때문에 명령 단계: Complete
    // *  >>> [SEB_1_TO_BW_3][COMPLETE], [SEB_2_TO_BW_3][COMPLETE],[SEB_3_TO_BW_3][COMPLETE]
    // *  >>> [SEB_4_TO_BW_3][COMPLETE],[SEB_5_TO_BW_3][COMPLETE],
    await eventToPromise(control, cmdStep.COMPLETE);
    await eventToPromise(control, cmdStep.COMPLETE);
    await eventToPromise(control, cmdStep.COMPLETE);
    await eventToPromise(control, cmdStep.COMPLETE);
    await eventToPromise(control, cmdStep.COMPLETE);

    expect(cmdManager.getCmdStorageList()).to.length(5);

    BU.CLI('TC_3 >>> 3 단계 완료');

    // * 4. BW_2.WL = 20, SEB_1.WL = 0, SEB_2.WL = 0,
    // *  <test> 동시 명령 중 목표 달성 시 개별 취소
    notifyDirectNodePlace([pn_WL_BW_2, 20], [pn_WL_SEB_1, 0], [pn_WL_SEB_2, 0]);
    // *    SEB_1.WL, SEB_2.WL 수위 최저치로 인한 명령 취소
    // *  >>> [SEB_1_TO_BW_3][END], [SEB_2_TO_BW_3][END], [SEB_3_TO_BW_3][COMPLETE]
    // *  >>> [SEB_4_TO_BW_3][COMPLETE], [SEB_5_TO_BW_3][COMPLETE],
    await eventToPromise(control, cmdStep.END);
    await eventToPromise(control, cmdStep.END);
    // *  <test> DP 염수 부족으로 인한 BP(단일) 강제 급수 진행
    // *    BW_2.WL: 20, BW_2.Able_WV: (20-10) * 0.27 = 2.7 m3, SEB_1.Need_WV: (3 + (5-3)/2) = 4 m3
    // *    BW_2.Able_WV(2.7) < SEB_1.Need_WV(4) 이므로 DP 강제 급수 진행
    // *      강제 요청 >>> [NEB_2_TO_BW_2](R_CON), 단일 강제 급수이므로 달성 목표 발생
    /** @type {CmdStorage} */
    const cs_NEB_2_TO_BW_2 = await eventToPromise(control, cmdStep.COMPLETE);

    expect(getNodeIds(cs_NEB_2_TO_BW_2, sConV.REAL_TRUE)).to.deep.eq(['WD_006']);
    expect(getNodeIds(cs_NEB_2_TO_BW_2, sConV.IGNORE_FALSE)).to.length(2);
    // *       2번 요청 일어나나 1번은 무시
    // *  >>> [SEB_3_TO_BW_3][COMPLETE], [SEB_4_TO_BW_3][COMPLETE], [SEB_5_TO_BW_3][COMPLETE],
    // *  >>> [NEB_2_TO_BW_2][RUNNING]

    BU.CLI('TC_3 >>> 4 단계 완료');

    // * 5. BW_2.WL = 30, SEB_1.WL = 0, SEB_2.WL = 0,
    notifyDirectNodePlace([pn_WL_BW_2, 30], [pn_WL_SEB_1, 0], [pn_WL_SEB_2, 0]);
    // *  <test> 급수 요건 고려 시 개별적으로 고려.
    // *    SEB_1.Need_WV: 4, SEB_2.Need_WV: 4, BW_2.Able_WV: (30-10) * 0.27 = 5.4 m3,
    // *    합산 처리하면 불가능하나 개별적으로 보면 4 < 5.7 이므로 염수 이동
    // *  >>> [SEB_3_TO_BW_3][COMPLETE], [SEB_4_TO_BW_3][COMPLETE], [SEB_5_TO_BW_3][COMPLETE],
    // *  >>> [NEB_2_TO_BW_2][RUNNING],
    // *  >>> [BW_2_TO_SEB_1][RUNNING], [BW_2_TO_SEB_2][RUNNING]
    await eventToPromise(control, cmdStep.RUNNING);
    await eventToPromise(control, cmdStep.RUNNING);

    // 장치 FALSE, Ignore: true 목록
    // [
    //   'GV_101' * 3, [SEB_3_TO_BW_3], [SEB_4_TO_BW_3], [SEB_5_TO_BW_3]
    //   'GV_103' * 3, [SEB_3_TO_BW_3], [SEB_4_TO_BW_3], [SEB_5_TO_BW_3]
    //   'GV_105', [BW_2_TO_SEB_1]
    //   'GV_106', [BW_2_TO_SEB_1]
    //   'GV_107', [BW_2_TO_SEB_2]
    //   'GV_108', [BW_2_TO_SEB_2]
    //   'GV_110', [SEB_3_TO_BW_3]
    //   'GV_112', [SEB_4_TO_BW_3]
    //   'GV_114', [SEB_5_TO_BW_3]
    //   'WD_004', [NEB_2_TO_BW_2]
    //   'WD_005', [NEB_2_TO_BW_2]
    // ];
    expect(
      cmdManager.getCmdEleList({
        singleControlType: FALSE,
        isIgnore: true,
      }),
    ).to.length(15);

    // 장치 TRUE, Ignore: true 목록 (실제 장치 제어)
    // [
    //   'GV_102' * 3, [SEB_3_TO_BW_3], [SEB_4_TO_BW_3], [SEB_5_TO_BW_3] (SEB_1_TO_BW_3) 에서 유실됨
    //   'GV_104' * 3, [SEB_3_TO_BW_3], [SEB_4_TO_BW_3], [SEB_5_TO_BW_3] (SEB_1_TO_BW_3) 에서 유실됨
    // ]
    expect(
      cmdManager.getCmdEleList({
        singleControlType: TRUE,
        isIgnore: true,
      }),
    ).to.length(6);

    // 장치 TRUE, Ignore: false 목록 (실제 장치 제어)
    // [
    //   'GV_109', [SEB_3_TO_BW_3]
    //   'GV_111', [SEB_4_TO_BW_3],
    //   'GV_113', [SEB_5_TO_BW_3],
    //   'P_004',  [BW_2_TO_SEB_1]
    //   'P_005',  [BW_2_TO_SEB_2]
    //   'WD_006', [NEB_2_TO_BW_2]
    // ];
    expect(
      cmdManager.getCmdEleList({
        singleControlType: TRUE,
        isIgnore: false,
      }),
    ).to.length(6);

    BU.CLI('TC_3 >>> 5 단계 완료');
  });

  /**
   * @desc T.C 3 [자동 모드]
   *
   * @description
   * 1. 일반 증발지 2의 염수 수위
   * 2.
   */

  // * 해주 및 증발지의 면적에 따른 해수 부피를 산정하여 명령 수행 가능성 여부를 결정한다.
});

describe.skip('염도 임계치 처리 테스트', function() {
  this.timeout(10000);

  before(async () => {
    await control.init(dbInfo, config.uuid);
    control.runFeature();

    control.inquiryAllDeviceStatus();

    await eventToPromise(control, cmdStep.COMPLETE);
  });

  beforeEach(async () => {
    try {
      coreFacade.updateControlMode(controlMode.MANUAL);
      control.executeSetControl({
        wrapCmdId: 'closeAllDevice',
        wrapCmdType: reqWCT.CONTROL,
      });

      await eventToPromise(control, cmdStep.COMPLETE);
    } catch (error) {
      BU.error(error.message);
    }

    // 이전 명령이 남아있을 수 있으므로 강제 초기화
    coreFacade.cmdManager.commandList = [];
    coreFacade.updateControlMode(controlMode.POWER_OPTIMIZATION);
  });

  /**
   * @desc T.C 5
   * 염도 상한선 도달 시 염수 이동 조건을 체크하고 충족 시 염수 이동 명령을 내림.
   * 1. 염수 이동 그룹의 50% 이상이 만족해야함.
   * 2. 염수를 받을 급수지의 수위가 충분해야 함.
   * 3. 염수 이동 완료 후 원천 급수지에서 이동 그룹의 수위 설정 수위 또는 하한선 기준 30% 이상을 충족시켜야 함.
   * 4. 충족이 불가능할 경우 원천 급수지에 염수를 채울 수 있도록 명령을 내려야 함.
   * @description
   * DrainagePlace(DP): 염도 임계치에 도달한 수중 태양광 증발지
   * DrainagePlaces(DPS): 염도 임계치에 도달 시 동시에 움직일 수중 태양광 증발지 그룹
   * WaterSupplyPlace(WSP): 염수를 공급받을 해주
   * BasePlace(BP): 염수를 이동 한 후 수중 태양광 증발지로 염수를 재공급할 해주
   * Update Data Event: UDE , Data Type: DT, Data Status: DS,
   * Water Volume: WV, Able: Ab, After: Af, Need: N, Current: C, Remain: R, Lower: L, Set, Water Supply: WS, Drainage: D
   * WaterLevel: WL, Salinity: S, Module Rear Temperature: MRT,
   * GoalThreshold: GT, Node: N,
   * ThresholdMinUnder: TMU, ThresholdLowerLimitUnder: TLLU, ThresholdSet: TS,
   * ThresholdUpperLimitOver: TULO, ThresholdMaxOver: TMO
   * @tutorial
   * 0. 수중태양광 증발지 그룹(DPs_2)의 염도 임계치 도달 급수지 순위 변경
   *      DPs_1.putPlaceRankList = [BW_3]
   *      DPs_2.putPlaceRankList = [BW_4,BW_3,SEA]
   *    DPs, WSP의 Ab_WV 계산(width * height * depth / 1000000000). cm3 => m3
   *      해주 1 BW_WV: 12m * 3m * 1.5m = 54 m3, 0.01m 당 0.36 m3
   *      해주 2 BW_WV: 9m * 3m * 1.5m = 40.5 m3, 0.01m 당 0.27 m3
   *      해주 3, 4 BW_WV: 4m * 3m * 1.5m = 18 m3, 0.01m 당 0.12 m3
   *      수중태양광 증발지 SEB_WV: 3.56m * 28m * 0.15m = 14.95 m3 = 15 m3, 0.01 m 당 1 m3
   *      해주 3, 4 BW_WV_TMU: 4m * 3m * 0.1m = 1.2 m3
   *      일반 증발지 1 NEB_1_WV: 33m * 20m * 0.20m = 132 m3 = 0.01 m 당 6.6 m3
   *      일반 증발지 2 NEB_2_WV: 33m * 10m * 0.20m = 66 m3 = 0.01 m 당 3.3 m3
   *      수중태양광 증발지 SEB_WV_TMO: 3.56m * 28m * 0.15m = 14.95 m3 = 15 m3
   *      수중태양광 증발지 SEB_WV_TULO: 3.56m * 28m * 0.07m = 7 m3
   *      수중태양광 증발지 SEB_WV_TS: 3.56m * 28m * 0.05m = 5 m3
   *      수중태양광 증발지 SEB_WV_TLLU: 3.56m * 28m * 0.03m = 3 m3
   *      수중태양광 증발지 SEB_WV_TMU: 3.56m * 28m * 0.01m = 1 m3
   *          수중태양광 상한선 미만 SEB_WV_TLLU: 3.56m * 28m * 0.059m = 5.88 m3
   * 1. BW 2 ~ 4의 수위를 140cm로 설정, DPs_1.WL = 5, DPs_1.S = 12 설정
   *  <test> DPs_1의 현재 염수를 30% 이상 받을 수 있는 WSP이 없을 경우 아무런 조치를 취하지 않음
   *    (SEB_WV_TS - SEB_WV_TMU) * 3 = 20 m3, BW_3_WV = 4 * 3 * (1.5-1.4) = 1.2 m3
   *  DPs_2 그룹 내의 수중 증발지인 SEP_6.S = 20
   *  <test> DPs.S_TULO(18)에 달성률이 33%이므로 명령 수행이 이루어지지 않음
   * 2. DPs_2.WL = 5cm, BW_4.WL = 100cm, SEP_7.S = 20
   *  <test> DPs_2.S_TULO(18)에 달성률이 66%이므로 명령 알고리즘 수행
   *  <test> DPs_2의 현재 염수량과 WSP이 허용하는 염수량의 차를 구하여 DP의 남아있는 염수량 계산
   *    DPs_2_D_Ab_WV = (SEB_WV_TS - SEB_WV_TMU) * 3 = (5 - 1) * 3 = 12 m3
   *    해주에서 수용할 수 있는 염수량
   *    WSP_WS_Ab_WV = BW_WL_TMO - BW_WL_C = (4 * 3 * (1.5 - 1)) = 6 m3
   *    수중 증발지 그룹에서 해주로 염수를 보내고 난 후 남은 염수량
   *    DPs_2_D_Af_WV = DPs_2_D_Ab_WV - WSP_WS_Ab_WV = 12 - 6 = 6 m3
   *    DPs_2_N_WV = DPs_2_WV_TLLU + (DPs_2_WV_Set - DPs_2_WV_TLLU) / 2 = (3 * 3) + ((5 * 3) - (3 * 3)) / 2 = 12 m3
   *    DPs_2에서 받아야 할 실질적 염수량
   *    DPs_2_WS_Need_WV = DPs_2_N_WV - DPs_2_WV_TMU - DPs_2_D_Af_WV = 12 - 3 - 3 = 6 m3
   *  <test> DPs_2_WL의 설정과 하한선의 중간 염수량을 만족할 수 있다면 BP의 염수량은 충분하다고 가정함
   *    BP_Ab_WV = BW_3_WV_C - BW_3_WV_TMU = (4 * 3 * (1.4 - 0.1)) = 15.6 m3
   *    15.6 m3 > 6 m3 이므로 염수 이동
   *  [SEB_6_TO_BW_4,SEB_7_TO_BW_4,SEB_8_TO_BW_4](R_CON)  ::: 달성 목표: SEB_WL_TMU
   *  >>> [SEB_6_TO_BW_4][RUNNING], [SEB_7_TO_BW_4][RUNNING],[SEB_8_TO_BW_4][RUNNING]
   * 3. 데이터를 초기 상태로 돌리고 해주 2, 3의 수위를 20cm로 맞춤
   *  DPs_2.WL = 5cm, BW_2.WL = 110, BW_3.WL = 20
   *  진행 중인 DPs_2_TO_BW_4 명령 취소
   *    명령 취소: [SEB_6_TO_BW_4](R_CAN), [SEB_7_TO_BW_4](R_CAN), [SEB_8_TO_BW_4](R_CAN)
   *  <test> 명령이 순차적으로 해제될 때 누적 카운팅이 최종적으로 해제되는 장치 Close 처리
   *  >>> [SEB_6_TO_BW_4][END] -> ['GV_115'](CLOSE)
   *  >>> [SEB_7_TO_BW_4][END] -> ['GV_117'](CLOSE)
   *  >>> [SEB_8_TO_BW_4][END] -> ['GV_119','GV_103'](CLOSE)
   * 4. 배급수 명령 진행 1단계 점핑 가능 테스트
   *  <test> DP: DPs_2, WSP: BW_4, BP: BW_3, 배급수 불가로 인한 상위 호출 테스트
   *    DPs_2.drainageAbleWV: 12, BW_4.waterSupplyAbleWV: 6
   *    DPs_2.drainageAfterWV: 12 - 6
   *    DPs_2.needWV: (하한선 + (Set - 하한선) / 2) - 최저치 = (3 + (5 - 3) / 2) - 1 =  3 * 3 = 9
   *    DPs_2.realNeedWV: needWV - drainageAfterWV = 9 - 6 = 3
   *    BW_3.Able_WV: (20-10) * 0.12 = 1.2
   *      DPs_2.realNeedWV <= BW_3.Able_WV 이어야 하지만  3 > 1.2
   *      BP(BW_3)에서 급수를 진행할 수 없으므로 BP에 급수 요청
   *      다음 지역에 배급수 조건 탐색. DP = DPs_1, WSP = BW_3
   *  <test> 배급수 요청. DP: DPs_1, WSP: BW_3, BP: BW_2, BP 만족으로 인한 염수 이동
   *    DPs_1.drainageAbleWV: 20, BW_3.waterSupplyAbleWV: (150 - 20) * 0.12 =  15.6
   *    DPs_1.drainageAfterWV: 20 - 15.6
   *    DPs_1.needWV: (하한선 + (Set - 하한선) / 2) - 최저치 = (3 + (5 - 3) / 2) - 1 =  3 * 5 = 15
   *    DPs_1.realNeedWV: needWV - drainageAfterWV = 15 - 4.4 = 11.6
   *    BW_2.Able_WV: (110-10) * 0.27 = 27
   *      DPs_1.realNeedWV <= BW_2.Able_WV 이어야 하지만  11.6 < 27
   *      조건에 만족에 의한 염수 이동 요청 >>> [DPs_2_TO_BW_3](R_CON) 달성목표 DPs_2.WL_TMU
   *  >>> [SEB_1_TO_BW_3][RUNNING], [SEB_2_TO_BW_3][RUNNING],[SEB_3_TO_BW_3][RUNNING]
   *  >>> [SEB_4_TO_BW_3][RUNNING], [SEB_5_TO_BW_3][RUNNING]
   * 5. 배급수 명령 진행 2단계 점핑 가능 테스트
   * BW_2.WL = 20, SEB_1.WL = 1, BW_3.WL = 150
   *    명령 달성 >>> [SEB_1_TO_BW_3](R_CAN)
   *    급수지 수위 최대치 >>> [DPs_2_TO_BW_3](R_CAN)
   *  >>> [SEB_1_TO_BW_3][CANCELING] -> ['GV_105'](CLOSE)
   *  >>> [SEB_2_TO_BW_3][CANCELING] -> ['GV_107'](CLOSE)
   *  >>> [SEB_3_TO_BW_3][CANCELING] -> ['GV_109'](CLOSE)
   *  >>> [SEB_4_TO_BW_3][CANCELING] -> ['GV_111'](CLOSE)
   *  >>> [SEB_5_TO_BW_3][CANCELING] -> ['GV_113','GV_104','GV_102'](CLOSE)
   *  DPs_2.S = 20, NEB_2.WL = 11
   *  <test> DP: DPs_2, WSP: BW_4, BP: BW_3, 배급수 불가로 인한 상위 호출 테스트
   *    DPs_2.drainageAbleWV: 12, BW_4.waterSupplyAbleWV: 6
   *    DPs_2.drainageAfterWV: 12 - 6
   *    DPs_2.needWV: (하한선 + (Set - 하한선) / 2) - 최저치 = (3 + (5 - 3) / 2) - 1 =  3 * 3 = 9
   *    DPs_2.realNeedWV: needWV - drainageAfterWV = 9 - 6 = 3
   *    BW_3.Able_WV: (20-10) * 0.12 = 1.2
   *      DPs_2.realNeedWV <= BW_3.Able_WV 이어야 하지만  3 > 1.2
   *      BP(BW_3)에서 급수를 진행할 수 없으므로 BP에 급수 요청
   *      다음 지역에 배급수 조건 탐색. DP = DPs_1, WSP = BW_3
   *  <test> DP: DPs_1, WSP: BW_3, BP: BW_2, 배급수 불가로 인한 상위 호출 테스트
   *    DPs_1.drainageAbleWV: 20, BW_3.waterSupplyAbleWV: (150 - 20) * 0.12 =  15.6
   *    DPs_1.drainageAfterWV: 20 - 15.6
   *    DPs_1.needWV: (하한선 + (Set - 하한선) / 2) - 최저치 = (3 + (5 - 3) / 2) - 1 =  3 * 5 = 15
   *    DPs_1.realNeedWV: needWV - drainageAfterWV = 15 - 4.4 = 11.6
   *    BW_2.Able_WV: (20-10) * 0.27 = 2.7
   *      DPs_1.realNeedWV <= BW_2.Able_WV 이어야 하지만  11.6 > 2.7
   *      BP(BW_2)에서 급수를 진행할 수 없으므로 BP에 급수 요청
   *     다음 지역에 배급수 조건 탐색. DP = NEB_2, WSP = BW_2
   *  <test> DP: NEB_2, WSP: BW_2, 수중태양광 증발지가 아닌 DP는 배수 조건 충족시 염수 이동
   *    NEB_2.drainageAbleWV: (11 - 1) * 3.3 = 33,
   *    BW_2.waterSupplyAbleWV: (150 - 20) * 0.27 =  35.1
   *    NEB_2.drainageAfterWV: 33 - 35.1 = -2.1 염수 Full 이동 가능
   *     일반증발지 배급수 조건 체크 X >>> [NEB_2_TO_BW_2](R_CON): 달성 목표: BP.WL 최저치까지
   *  >>> [NEB_2_TO_BW_2][RUNNING]
   */
  it('염도 상한선 도달에 따른 자동 염수 이동', async () => {
    const { cmdManager, placeManager } = control.model;

    // 해주 2
    const ps_BW_2 = placeManager.findPlace(pId.BW_2);
    const pn_WL_BW_2 = ps_BW_2.getPlaceNode(ndId.WL);
    // 해주 3
    const ps_BW_3 = placeManager.findPlace(pId.BW_3);
    const pn_WL_BW_3 = ps_BW_3.getPlaceNode(ndId.WL);
    // 해주 4
    const ps_BW_4 = placeManager.findPlace(pId.BW_4);
    const pn_WL_BW_4 = ps_BW_4.getPlaceNode(ndId.WL);
    // 일반 증발지 2
    const ps_NEB_2 = placeManager.findPlace(pId.NEB_2);
    const pn_WL_NEB_2 = ps_NEB_2.getPlaceNode(ndId.WL);
    const pn_S_NEB_2 = ps_NEB_2.getPlaceNode(ndId.S);
    // 수중 증발지 1
    const ps_SEB_1 = placeManager.findPlace(pId.SEB_1);
    const pn_WL_SEB_1 = ps_SEB_1.getPlaceNode(ndId.WL);
    const pn_S_SEB_1 = ps_SEB_1.getPlaceNode(ndId.S);
    // 수중 증발지 2
    const ps_SEB_2 = placeManager.findPlace(pId.SEB_2);
    const pn_WL_SEB_2 = ps_SEB_2.getPlaceNode(ndId.WL);
    const pn_S_SEB_2 = ps_SEB_2.getPlaceNode(ndId.S);
    // 수중 증발지 3
    const ps_SEB_3 = placeManager.findPlace(pId.SEB_3);
    const pn_WL_SEB_3 = ps_SEB_3.getPlaceNode(ndId.WL);
    const pn_S_SEB_3 = ps_SEB_3.getPlaceNode(ndId.S);
    // 수중 증발지 4
    const ps_SEB_4 = placeManager.findPlace(pId.SEB_4);
    const pn_WL_SEB_4 = ps_SEB_4.getPlaceNode(ndId.WL);
    const pn_S_SEB_4 = ps_SEB_4.getPlaceNode(ndId.S);
    // 수중 증발지 5
    const ps_SEB_5 = placeManager.findPlace(pId.SEB_5);
    const pn_WL_SEB_5 = ps_SEB_5.getPlaceNode(ndId.WL);
    const pn_S_SEB_5 = ps_SEB_5.getPlaceNode(ndId.S);
    // 수중 증발지 6
    const ps_SEB_6 = placeManager.findPlace(pId.SEB_6);
    const pn_WL_SEB_6 = ps_SEB_6.getPlaceNode(ndId.WL);
    const pn_S_SEB_6 = ps_SEB_6.getPlaceNode(ndId.S);
    // 수중 증발지 7
    const ps_SEB_7 = placeManager.findPlace(pId.SEB_7);
    const pn_WL_SEB_7 = ps_SEB_7.getPlaceNode(ndId.WL);
    const pn_S_SEB_7 = ps_SEB_7.getPlaceNode(ndId.S);
    // 수중 증발지 8
    const ps_SEB_8 = placeManager.findPlace(pId.SEB_8);
    const pn_WL_SEB_8 = ps_SEB_8.getPlaceNode(ndId.WL);
    const pn_S_SEB_8 = ps_SEB_8.getPlaceNode(ndId.S);

    // * 1. 수중태양광 증발지 그룹(DPs_2)의 염도 임계치 도달 급수지 순위 변경
    const DPs_1 = [ps_SEB_1, ps_SEB_2, ps_SEB_3, ps_SEB_4, ps_SEB_5];
    const DPs_2 = [ps_SEB_6, ps_SEB_7, ps_SEB_8];
    // *   DPs_S_1.putPlaceRankList = [BW_3]
    DPs_1.forEach(dpStorage => {
      // 하한선을 3으로 고정
      dpStorage.getPlaceNode(ndId.WL).lowerLimitValue = {
        value: 3,
        isCall: true,
      };
      dpStorage.getPlaceNode(ndId.S).putPlaceRankList = [pId.BW_3];
    });
    // *   DPs_S_2.putPlaceRankList = [BW_4,BW_3,SEA]
    DPs_2.forEach(dpStorage => {
      // 하한선을 3으로 고정
      dpStorage.getPlaceNode(ndId.WL).lowerLimitValue = {
        value: 3,
        isCall: true,
      };
      dpStorage.getPlaceNode(ndId.S).putPlaceRankList = [
        pId.BW_4,
        pId.BW_3,
        // pId.SEA,
      ];
    });

    /**
     * 장소 저장소 목록에 값을 세팅하고자 할 경우
     * @param {PlaceStorage} placeStorageList
     * @param {number=} setWaterLevel
     * @param {number=} setSalinity
     */
    function setPlaceStorage(placeStorageList, setWaterLevel, setSalinity) {
      placeStorageList.forEach(placeStorage => {
        try {
          control.notifyDeviceData(null, [
            _.isNumber(setWaterLevel) &&
              setNodeData(placeStorage.getPlaceNode(ndId.WL), setWaterLevel),
          ]);
        } catch (error) {
          // BU.error(error.message);
        }
      });

      placeStorageList.forEach(placeStorage => {
        try {
          control.notifyDeviceData(null, [
            _.isNumber(setSalinity) && setNodeData(placeStorage.getPlaceNode(ndId.S), setSalinity),
          ]);
        } catch (error) {
          // BU.error(error.message);
        }
      });
    }

    // * 1. BW 2 ~ 4의 수위를 140cm로 설정, DPs_1.WL = 5, DPs_1.S = 12 설정
    notifyDirectNodePlace([pn_WL_BW_2, 140], [pn_WL_BW_3, 140], [pn_WL_BW_4, 140]);

    // DPs_2.WL = 4, DPs_2.S = 10 설정
    setPlaceStorage(DPs_2, 4, 10);
    // DPs_1.WL = 3.1, DPs_1.S = 12 설정, DPs_1의 하한선은 3이므로 수행하지 못함
    // *  <test> DPs_1의 현재 염수를 30% 이상 받을 수 있는 WSP이 없을 경우 아무런 조치를 취하지 않음
    setPlaceStorage(DPs_1, 3.1, 12);

    // DPs_1.WL = 5, 하한선 10%. 3.19 이상을 만족하므로 알고리즘 수행
    setPlaceStorage(DPs_1, null, 0);
    setPlaceStorage(DPs_1, 5, 12);

    // *    (SEB_WV_TS - SEB_WV_TMU) * 5 = 20 m3, BW_3_WV = 4 * 3 * (1.5-1.4) = 1.2 m3
    expect(cmdManager.getCmdStorageList()).to.length(0);

    // *  DPs_2 그룹 내의 수중 증발지인 SEP_6.S = 20
    // *  <test> DPs.S_TULO(18)에 달성률이 33%이므로 명령 수행이 이루어지지 않음
    notifyDirectNodePlace([pn_S_SEB_6, 20]);
    expect(() => notifyDirectNodePlace([pn_S_SEB_6, 20])).to.throw(
      'Place: SEB_6.It is not a moveable brine threshold group.',
    );
    expect(cmdManager.getCmdStorageList()).to.length(0);

    BU.CLI('TC_5 >>> 1 단계 완료');

    // * 2. DPs_2.WL = 5cm, BW_4.WL = 100cm, SEP_7.S = 20
    // *  SEP_7.S = 20
    // *  <test> DPs_2.S_TULO(18)에 달성률이 66%이므로 명령 알고리즘 수행
    // 해주의 염수가 이를 수용하지 못하므로 실패
    expect(() => notifyDirectNodePlace([pn_S_SEB_7, 20])).to.throw(
      'Place: SEB_7. There is no place to receive water at the place.',
    );

    // *  BW_4.WL = 100cm, SEP_7.S = 20
    // setPlaceStorage(DPs_2, 4);
    // 배급수를 하기에 충분한 염수가 준비되어 있으므로 명령 실행됨.
    notifyDirectNodePlace([pn_WL_BW_4, 100], [pn_S_SEB_7, 20]);

    // *  <test> DPs_2의 현재 염수량과 WSP이 허용하는 염수량의 차를 구하여 DP의 남아있는 염수량 계산
    // *    DPs_2_D_Ab_WV = (SEB_WV_TS - SEB_WV_TMU) * 3 = (5 - 1) * 3 = 12 m3
    // *    해주에서 수용할 수 있는 염수량
    // *    WSP_WS_Ab_WV = BW_WL_TMO - BW_WL_C = (4 * 3 * (1.5 - 1)) = 6 m3
    // *    수중 증발지 그룹에서 해주로 염수를 보내고 난 후 남은 염수량
    // *    DPs_2_D_Af_WV = DPs_2_D_Ab_WV - WSP_WS_Ab_WV = 12 - 6 = 6 m3
    // *    DPs_2_N_WV = DPs_2_WV_TLLU + (DPs_2_WV_Set - DPs_2_WV_TLLU) / 2 = (3 * 3) + ((5 * 3) - (3 * 3)) / 2 = 12 m3
    // *    DPs_2에서 받아야 할 실질적 염수량
    // *    DPs_2_WS_Need_WV = DPs_2_N_WV - DPs_2_WV_TMU - DPs_2_D_Af_WV = 12 - 3 - 3 = 6 m3
    // *  <test> DPs_2_WL의 설정과 하한선의 중간 염수량을 만족할 수 있다면 BP의 염수량은 충분하다고 가정함
    // *    BP_Ab_WV = BW_3_WV_C - BW_3_WV_TMU = (4 * 3 * (1.4 - 0.1)) = 15.6 m3
    // *    15.6 m3 > 6 m3 이므로 염수 이동
    // *  [SEB_6_TO_BW_4,SEB_7_TO_BW_4,SEB_8_TO_BW_4](R_CON)  ::: 달성 목표: SEB_WL_TMU
    /** @type {CmdStorage} */
    await eventToPromise(control, cmdStep.RUNNING);
    await eventToPromise(control, cmdStep.RUNNING);
    await eventToPromise(control, cmdStep.RUNNING);

    // 수문 103은 열림 중첩이 3번 되어 있음
    expect(
      cmdManager.getCmdEleList({
        nodeId: 'GV_103',
        singleControlType: TRUE,
      }),
    ).to.length(3);
    // 실제 여는것은 1번
    expect(
      cmdManager.getCmdEleList({
        nodeId: 'GV_103',
        singleControlType: TRUE,
        isIgnore: false,
      }),
    ).to.length(1);

    BU.CLI('TC_5 >>> 2 단계 완료');

    // * 3. 데이터를 초기 상태로 돌리고 해주 2, 3의 수위를 20cm로 맞춤
    // *  DPs_2.WL = 5cm, DPs_2.S = 10, BW_2.WL = 100, BW_3.WL = 20
    setPlaceStorage(DPs_2, 5, 10);
    notifyDirectNodePlace([pn_WL_BW_2, 100], [pn_WL_BW_3, 20]);

    // *  진행 중인 DPs_2_TO_BW_4 명령 취소
    // ['GV_115'][CLOSE]
    const cs_SEB_6_TO_BW_4 = control.executeFlowControl({
      wrapCmdType: reqWCT.CANCEL,
      srcPlaceId: pId.SEB_6,
      destPlaceId: pId.BW_4,
    });
    // ['GV_117'][CLOSE]
    const cs_SEB_7_TO_BW_4 = control.executeFlowControl({
      wrapCmdType: reqWCT.CANCEL,
      srcPlaceId: pId.SEB_7,
      destPlaceId: pId.BW_4,
    });
    // 누적 카운팅 초기화 ['GV_119','GV_103'][CLOSE]
    const cs_SEB_8_TO_BW_4 = control.executeFlowControl({
      wrapCmdType: reqWCT.CANCEL,
      srcPlaceId: pId.SEB_8,
      destPlaceId: pId.BW_4,
    });

    // *  <test> 명령이 순차적으로 해제될 때 누적 카운팅이 최종적으로 해제되는 장치 Close 처리
    // *  >>> [SEB_6_TO_BW_4][CANCELING] -> ['GV_115'](CLOSE)
    expect(_.map(cs_SEB_6_TO_BW_4.restoreCmdList, 'nodeId')).to.deep.eq(['GV_115']);
    // *  >>> [SEB_7_TO_BW_4][CANCELING] -> ['GV_117'](CLOSE)
    expect(_.map(cs_SEB_7_TO_BW_4.restoreCmdList, 'nodeId')).to.deep.eq(['GV_117']);
    // *  >>> [SEB_8_TO_BW_4][CANCELING] -> ['GV_119','GV_103'](CLOSE)
    expect(_.map(cs_SEB_8_TO_BW_4.restoreCmdList, 'nodeId')).to.deep.eq(['GV_119', 'GV_103']);

    // *  [DPs_2_TO_BW_4](R_CAN)
    await eventToPromise(control, cmdStep.END);
    await eventToPromise(control, cmdStep.END);
    await eventToPromise(control, cmdStep.END);

    expect(cmdManager.getCmdStorageList()).to.length(0);
    expect(cmdManager.getCmdStorageList(sConV.TRUE)).to.length(0);

    // *  <test> BP(BW_3)의 염수가 부족하기 때문에 BP에 염수를 댈 수 있는 배급수 실행
    // *    [NEB_2_TO_BW_2](R_CON)

    BU.CLI('TC_5 >>> 3 단계 완료');

    // * 4. 배급수 명령 진행 1단계 점핑 가능 테스트
    // *  <test> DP: DPs_2, WSP: BW_4, BP: BW_3, 배급수 불가로 인한 상위 호출 테스트
    // *  DPs_2.S = 20
    setPlaceStorage(DPs_2, null, 20);

    /** @type {CmdStorage} */
    const cs_SEB_1_TO_BW_3 = await eventToPromise(control, cmdStep.RUNNING);

    // *    DPs_2.drainageAbleWV: 12, BW_4.waterSupplyAbleWV: 6
    // *    DPs_2.drainageAfterWV: 12 - 6
    // *    DPs_2.needWV: (하한선 + (Set - 하한선) / 2) - 최저치 = (3 + (5 - 3) / 2) - 1 =  3 * 3 = 9
    // *    DPs_2.realNeedWV: needWV - drainageAfterWV = 9 - 6 = 3
    // *    BW_3.Able_WV: (20-10) * 0.12 = 1.2
    // *      DPs_2.realNeedWV <= BW_3.Able_WV 이어야 하지만  3 > 1.2
    // *      BP(BW_3)에서 급수를 진행할 수 없으므로 BP에 급수 요청
    // *      다음 지역에 배급수 조건 탐색. DP = DPs_1, WSP = BW_3
    // *  <test> 배급수 요청. DP: DPs_1, WSP: BW_3, BP: BW_2, BP 만족으로 인한 염수 이동
    // *    DPs_1.drainageAbleWV: 20, BW_3.waterSupplyAbleWV: (150 - 20) * 0.12 =  15.6
    // *    DPs_1.drainageAfterWV: 20 - 15.6
    // *    DPs_1.needWV: (하한선 + (Set - 하한선) / 2) - 최저치 = (3 + (5 - 3) / 2) - 1 =  3 * 5 = 15
    // *    DPs_1.realNeedWV: needWV - drainageAfterWV = 15 - 4.4 = 11.6
    // *    BW_2.Able_WV: (110-10) * 0.27 = 27
    // *      DPs_1.realNeedWV <= BW_2.Able_WV 이어야 하지만  11.6 < 27
    // *      조건에 만족에 의한 염수 이동 요청 >>> [DPs_2_TO_BW_3](R_CON) 달성목표 DPs_2.WL_TMU
    // *  >>> [SEB_1_TO_BW_3][RUNNING], [SEB_2_TO_BW_3][RUNNING],[SEB_3_TO_BW_3][RUNNING]
    // *  >>> [SEB_4_TO_BW_3][RUNNING], [SEB_5_TO_BW_3][RUNNING]
  });
});
