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

const {
  dcmConfigModel: {
    complexCmdStep,
    reqWrapCmdType: reqWCT,
    reqDeviceControlType: { TRUE, FALSE, SET, MEASURE },
  },
} = CoreFacade;

const MuanControl = require('../../../src/projects/UPSAS/muan/MuanControl');

const ThreCmdComponent = require('../../../src/core/CommandManager/ThresholdCommand/ThreCmdComponent');

const { goalDataRange } = ThreCmdComponent;

process.env.NODE_ENV = 'development';

const { dbInfo } = config;

const main = new Main();
// const control = main.createControl({
//   dbInfo: config.dbInfo,
// });
const control = main.createControl(config);
const coreFacade = new CoreFacade();

const ndId = {
  S: 'salinity',
  WL: 'waterLevel',
  BT: 'brineTemperature',
  MRT: 'moduleRearTemperature',
};

const pId = {
  RV: 'RV',
  SEA: 'SEA',
  NEB_1: 'NEB_1',
  NEB_2: 'NEB_2',
  NCB: 'NCB',
  SEB_1: 'SEB_1',
  SEB_2: 'SEB_2',
  SEB_3: 'SEB_3',
  SEB_4: 'SEB_4',
  SEB_5: 'SEB_5',
  SEB_6: 'SEB_6',
  SEB_7: 'SEB_7',
  SEB_8: 'SEB_8',
  BW_1: 'BW_1',
  BW_2: 'BW_2',
  BW_3: 'BW_3',
  BW_4: 'BW_4',
  BW_5: 'BW_5',
};

/** 제어 모드 */
const controlMode = {
  MANUAL: 'MANUAL',
  POWER_OPTIMIZATION: 'POWER_OPTIMIZATION',
  SALTERN_POWER_OPTIMIZATION: 'SALTERN_POWER_OPTIMIZATION',
  RAIN: 'RAIN',
};

/**
 *
 * @param {PlaceNode} placeNode
 * @param {*} setValue
 */
function setNodeData(placeNode, setValue) {
  _.set(placeNode, 'nodeInfo.data', setValue);

  return _.get(placeNode, 'nodeInfo');
}

describe('수위 임계치 처리 테스트', function() {
  this.timeout(5000);

  before(async () => {
    await control.init(dbInfo, config.uuid);
    control.runFeature();

    coreFacade.updateControlMode(controlMode.MANUAL);

    control.inquiryAllDeviceStatus();
    await eventToPromise(control, 'completeInquiryAllDeviceStatus');
  });

  beforeEach(async () => {
    try {
      control.executeSetControl({
        wrapCmdId: 'closeAllDevice',
        wrapCmdType: reqWCT.CONTROL,
      });
      await eventToPromise(control, 'completeCommand');
    } catch (error) {
      BU.error(error.message);
    }

    coreFacade.updateControlMode(controlMode.POWER_OPTIMIZATION);
  });

  /**
   * 자동 염수 이동 명령이 없는 장소에 일반 염수 이동 명령을 내릴 경우
   * 배수지 수위 최저치(Min) 및 급수지 수위 최대치(Max)에 의해 명령 취소 테스트
   * @tutorial
   * 1. 결정지의 수위를 Max값(15cm)으로 설정하고 해주 5의 수위를 Min값(10cm)으로 설정
   *  <test> 배수지의 수위 최저치 이하 또는 급수지의 수위 최대치 이상일 경우 염수 이동 불가
   *      명령 요청 >>> [BW_5_TO_NCB](R_CON){Expect Fail}
   * 2. 해주 5의 수위를 정상 (130cm) 설정
   *  <test> 급수지(결정지)의 수위가 최대치 이상일 경우 명령 불가
   *      명령 요청 >>> [BW_5_TO_NCB](R_CON){Expect Fail}
   *    결정지의 수위를 Set값(5cm) 설정
   *  <test> 배수지의 수위 정상 값, 급수지의 수위 정상값 일 경우 염수 이동 가능
   *      명령 요청 >>> [BW_5_TO_NCB](R_CON->C_CON){Expect Success}
   * 3. 결정지의 수위를 Max값 이상(15cm) 설정.
   *  <test> 급수지의 수위 최대치에 의한 명령 취소
   *      급수지 수위 최대치 >>> [BW_5_TO_NCB](R_CAN)
   *    결정지의 수위를 Set값(5cm) 설정.
   *      명령 요청 >>> [BW_5_TO_NCB](R_CON->C_CON) :: 달성 목표: 급수지(결정지) 수위 10cm 이상, 달성 제한 시간: 2 Sec
   *    해주 5의 수위를 Min(10cm) 설정. [해주 5 > 결정지 ] 진행 중 명령 삭제 및 임계 명령 삭제 확인
   *  <test> 배수지의 수위 최저치에 의한 명령 취소
   *      배수지 수위 최저치 >>> [BW_5_TO_NCB](R_CAN)
   *  <test> 장소 임계치에 의한 명령 삭제 시 임계 명령 삭제 확인
   */
  it('급배수지 수위 최저, 최대치에 의한 명령 처리', async () => {
    const { placeManager } = control.model;
    const {
      cmdManager,
      cmdManager: { cmdOverlapManager, threCmdManager },
    } = control.model;

    // 저수지
    const ps_BW_5 = placeManager.findPlace(pId.BW_5);
    const pn_WL_BW_5 = ps_BW_5.getPlaceNode({ nodeDefId: ndId.WL });
    // 일반 증발지 1
    const ps_NCB = placeManager.findPlace(pId.NCB);
    const pn_WL_NCB = ps_NCB.getPlaceNode({ nodeDefId: ndId.WL });

    expect(cmdOverlapManager.getExistOverlapStatusList()).to.length(0);

    // * 1. 결정지의 수위를 Max값(15cm)으로 설정하고 해주 5의 수위를 Min값(10cm)으로 설정
    control.notifyDeviceData(null, [setNodeData(pn_WL_NCB, 15), setNodeData(pn_WL_BW_5, 10)]);

    /** @type {reqFlowCmdInfo} 해주 5 >>> 결정지 */
    const BW5ToNCB = {
      srcPlaceId: ps_BW_5.getPlaceId(),
      destPlaceId: ps_NCB.getPlaceId(),
      wrapCmdType: reqWCT.CONTROL,
    };
    // *  <test> 배수지의 수위 최저치 이하 또는 급수지의 수위 최대치 이상일 경우 염수 이동 불가
    // *    명령 요청 >>> [BW_5_TO_NCB](R_CON){Expect Fail}
    expect(() => control.executeFlowControl(BW5ToNCB)).to.throw(
      'The water level of the srcPlaceId: BW_5 is below the minimum water level',
    );

    // * 2. 해주 5의 수위를 정상 (130cm) 설정
    control.notifyDeviceData(null, [setNodeData(pn_WL_BW_5, 130)]);

    // *  <test> 급수지(결정지)의 수위가 최대치 이상일 경우 명령 불가
    // *      명령 요청 >>> [BW_5_TO_NCB](R_CON){Expect Fail}
    expect(() => control.executeFlowControl(BW5ToNCB)).to.throw(
      'The water level of the destPlaceId: NCB is over the max water level.',
    );

    // *    결정지의 수위를 Set값(5cm) 설정
    control.notifyDeviceData(null, [setNodeData(pn_WL_NCB, 5)]);

    // *  <test> 배수지의 수위 정상 값, 급수지의 수위 정상값 일 경우 염수 이동 가능
    // *    명령 요청 >>> [BW_5_TO_NCB](R_CON->C_CON){Expect Success}
    control.executeFlowControl(BW5ToNCB);

    /** @type {complexCmdWrapInfo} */
    const BW_5_To_NCB_WC_CONTROL = await eventToPromise(control, 'completeCommand');

    // * trueNodeList: ['P_014'],
    expect(cmdOverlapManager.getExistSimpleOverlapList(TRUE)).to.length(1);
    // * falseNodeList: ['WD_008'],
    expect(cmdOverlapManager.getExistSimpleOverlapList(FALSE)).to.length(1);

    // * 3. 결정지의 수위를 Max값 이상(15cm) 설정.
    control.notifyDeviceData(null, [setNodeData(pn_WL_NCB, 15)]);
    // *  <test> 급수지의 수위 최대치에 의한 명령 취소
    // *    급수지 수위 최대치 >>> [BW_5_TO_NCB](R_CAN)
    expect(cmdManager.getFlowCommand(pId.BW_5, pId.NCB).wrapCmdType).to.eq(reqWCT.CANCEL);

    // * trueNodeList: [],
    expect(cmdOverlapManager.getExistSimpleOverlapList(TRUE)).to.length(0);
    // * falseNodeList: [],
    expect(cmdOverlapManager.getExistSimpleOverlapList(FALSE)).to.length(0);

    // 수위 갱신을 한번 더 했을 경우 이미 취소 명령을 실행 중이므로 아무런 일도 일어나지 않음.
    control.notifyDeviceData(null, [setNodeData(pn_WL_NCB, 15)]);
    // * trueNodeList: [],
    expect(cmdOverlapManager.getExistSimpleOverlapList(TRUE)).to.length(0);
    // * falseNodeList: [],
    expect(cmdOverlapManager.getExistSimpleOverlapList(FALSE)).to.length(0);

    // FIXME: 취소 요청 중에 Control 요청이 들어갈 경우 실제 제어할 장치와의 상태 위반에 걸리기 때문에 명령이 씹힘.
    // 어떻게 처리할지 생각 필요.

    /** @type {complexCmdWrapInfo} */
    let BW_5_To_NCB_WC_CANCEL = await eventToPromise(control, 'completeCommand');

    expect(BW_5_To_NCB_WC_CONTROL.wrapCmdId).to.eq(BW_5_To_NCB_WC_CANCEL.wrapCmdId);

    // *    결정지의 수위를 Set값(5cm) 설정.
    control.notifyDeviceData(null, [setNodeData(pn_WL_NCB, 5)]);

    expect(cmdOverlapManager.getExistOverlapStatusList()).to.length(0);

    BW5ToNCB.wrapCmdGoalInfo = {
      limitTimeSec: 2,
      goalDataList: [
        {
          nodeId: pn_WL_NCB.getNodeId(),
          goalValue: 10,
          goalRange: goalDataRange.UPPER,
        },
      ],
    };
    // *      명령 요청 >>> [BW_5_TO_NCB](R_CON->C_CON) :: 달성 목표: 급수지(결정지) 수위 10cm 이상, 달성 제한 시간: 2 Sec
    const wrapCmdInfo = control.executeFlowControl(BW5ToNCB);

    // 명령이 완료되기를 기다림
    await eventToPromise(control, 'completeCommand');

    // 임계 명령이 존재해야 한다.
    const threCmdInfo = threCmdManager.getThreCmdStorage(wrapCmdInfo);
    const threCmdGoalInfo = threCmdInfo.getThreCmdGoal(pn_WL_NCB.getNodeId());

    // 결정지에 수위 임계 목표가 설정되어야 한다.
    expect(threCmdGoalInfo.threCmdGoalId).to.eq(pn_WL_NCB.getNodeId());
    expect(threCmdManager.threCmdStorageList).to.length(1);

    // *    해주 5의 수위를 Min(10cm) 설정. [해주 5 > 결정지 ] 진행 중 명령 삭제 및 임계 명령 삭제 확인
    control.notifyDeviceData(null, [setNodeData(pn_WL_BW_5, 10)]);

    // *  <test> 배수지의 수위 최저치에 의한 명령 취소
    BW_5_To_NCB_WC_CANCEL = await eventToPromise(control, 'completeCommand');

    // 명령은 취소 처리 되었음.
    expect(cmdManager.getComplexCommand(wrapCmdInfo.wrapCmdId)).to.undefined;
    // *  <test> 장소 임계치에 의한 명령 삭제 시 임계 명령 삭제 확인
    // 임계 명령은 제거되어야 한다.
    expect(threCmdManager.threCmdStorageList).to.length(0);
    // 현재 실행 중인 명령은 없음.
    expect(cmdManager.complexCmdList).to.length(0);
    // 누적 호출을 지닌 노드는 없음.
    expect(cmdOverlapManager.getExistOverlapStatusList()).to.length(0);
  });

  /**
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
   * 2. 급수지(일반 증발지 2)의 수위를 GT와 ULO 사이인 16으로 변경.
   *  <test> 목표가 있는 명령이라도 수위 상한선에 걸리면 명령을 취소.
   *      급수지 수위 상한선 >>> [NEB_1_TO_NEB_2](R_CAN)
   *  <test> 수위 상한선에 의한 자동 배수 (설정 수위 복원)  :: 달성 목표: 배수지(일반 증발지 2) 수위 12cm 이하
   *      일반 증발지 2 수위 상한선 >>> [NEB_2_TO_BW_1](R_CON)
   * 3. 일반 증발지 2의 수위를 정상(10)으로 교체 후 1번 재요청
   *      목표 달성 >>> [NEB_2_TO_BW_1](R_CAN)
   *      명령 요청 >>> [NEB_1_TO_NEB_2](R_CON) {GT= NEB_1.WL: 4, NEB_2.WL: 18}
   * 4. 일반 증발지 1의 수위를 GT와 LLU 사이인 5로 변경.
   *  <test> 급수지로의 목표가 있는 명령이고 현재 그 명령을 달성하지 못했다면 하한선 무시
   * 5. 일반 증발지 1의 수위를 Min인 이하인 0으로 변경
   *  <test> 장소 임계치와 목표달성 임계치가 동시에 만족할 경우 명령 취소는 1번이 정상적으로 처리
   *      배수지 수위 최저치 >>> [NEB_1_TO_NEB_2](R_CAN)
   *  <test> 수위 하한선에 의한 자동 급수 요청
   *      일반 증발지 1 수위 하한선 >>> [RV_TO_NEB_1](R_CON) :: 달성 목표: 급수지(일반 증발지 1) 수위 10cm 이상
   * 6. 해주 수위 최저치 10cm 변경, 일반 증발지 2 하한선 수위 4cm 변경
   *  <test> 수위 하한선에 의한 배수지 탐색 시 모든 배수지가 수위 최저치 이하라면 1순위 배수지에 급수 요청
   *      일반 증발지 2 수위 하한선 >>> 배수지 수위 부족으로 인한 실패
   * 7. 일반 증발지 1의 수위를 GT.WL UPPER 10cm 설정, 일반 증발지 2 수위 갱신
   *    목표 달성 >>> [RV_TO_NEB_1](R_CAN)
   *  <test> 자동 급수 요청 우선 순위에 따라 급수 대상 탐색. 1순위(해주 1) 자격 미달에 의한 2순위 지역 급수 요청
   *      수위 하한선 >>> [NEB_1_TO_NEB_2](R_CON) :: 달성 목표: 급수지(일반 증발지 2) 수위 12cm 이상
   */
  it('수위 임계치에 의한 우선 순위 염수 이동 명령 자동 생성 및 취소', async () => {
    const { placeManager } = control.model;
    const {
      cmdManager,
      cmdManager: { getFlowCommand, cmdOverlapManager, threCmdManager },
    } = control.model;

    // const {getFlowCommand} = cmdManager;

    const getFlowCmd = (srcPlaceId, destPlaceId) => {
      return cmdManager.getFlowCommand(srcPlaceId, destPlaceId);
    };

    // 저수지
    const ps_RV = placeManager.findPlace(pId.RV);
    const pn_WL_RV = ps_RV.getPlaceNode({ nodeDefId: ndId.WL });
    // 일반 증발지 1
    const ps_NEB_1 = placeManager.findPlace(pId.NEB_1);
    const pn_WL_NEB_1 = ps_NEB_1.getPlaceNode({ nodeDefId: ndId.WL });
    // 일반 증발지 2
    const ps_NEB_2 = placeManager.findPlace(pId.NEB_2);
    const pn_WL_NEB_2 = ps_NEB_2.getPlaceNode({ nodeDefId: ndId.WL });
    // 해주 1
    const ps_BW_1 = placeManager.findPlace(pId.BW_1);
    const pn_WL_BW_1 = ps_BW_1.getPlaceNode({ nodeDefId: ndId.WL });
    // 해주 2
    const ps_BW_2 = placeManager.findPlace(pId.BW_2);
    const pn_WL_BW_2 = ps_BW_2.getPlaceNode({ nodeDefId: ndId.WL });

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
            goalRange: goalDataRange.LOWER,
          },
          {
            nodeId: pn_WL_NEB_2.getNodeId(),
            goalValue: 18,
            goalRange: goalDataRange.UPPER,
          },
        ],
      },
    };
    //  *    명령 요청 >>> [NEB_1_TO_NEB_2](R_CON) {GT= NEB_1.WL: 4, NEB_2.WL: 18}
    control.executeFlowControl(NEB_1_TO_NEB_2);

    /** @type {complexCmdWrapInfo} */
    let wc_NEB_1_TO_NEB_2 = await eventToPromise(control, 'completeCommand');

    // expect(wc_NEB_1_TO_NEB_2.srcPlaceId).to.eq(pId.NEB_1);
    // expect(wc_NEB_1_TO_NEB_2.destPlaceId).to.eq(pId.NEB_2);
    expect(wc_NEB_1_TO_NEB_2).to.own.include({ srcPlaceId: pId.NEB_1, destPlaceId: pId.NEB_2 });

    //  * 2. 급수지(일반 증발지 2)의 수위를 GT와 ULO 사이인 16으로 변경.
    //  *  <test> 목표가 있는 명령이라도 수위 상한선에 걸리면 명령을 취소.
    control.notifyDeviceData(null, [setNodeData(pn_WL_NEB_2, 16)]);
    //  *    급수지 수위 상한선 >>> [NEB_1_TO_NEB_2](R_CAN)
    expect(getFlowCmd(pId.NEB_1, pId.NEB_2).wrapCmdType).to.eq(reqWCT.CANCEL);
    wc_NEB_1_TO_NEB_2 = await eventToPromise(control, 'completeCommand');

    // *  <test> 수위 상한선에 의한 자동 배수 (설정 수위 복원)  :: 달성 목표: 배수지(일반 증발지 2) 수위 12cm 이하
    // *    일반 증발지 2 수위 상한선 >>> [NEB_2_TO_BW_1](R_CON)
    let wc_NEB_2_TO_BW_1 = await eventToPromise(control, 'completeCommand');
    expect(cmdManager.getFlowCommandList()).to.length(1);

    expect(cmdOverlapManager.getExistSimpleOverlapList(TRUE)).to.length(3);
    expect(cmdOverlapManager.getExistSimpleOverlapList(FALSE)).to.length(2);

    // * 3. 일반 증발지 2의 수위를 정상(10)으로 교체
    control.notifyDeviceData(null, [setNodeData(pn_WL_NEB_2, 10)]);
    // *    목표 달성 >>> [NEB_2_TO_BW_1](R_CAN)
    wc_NEB_2_TO_BW_1 = await eventToPromise(control, 'completeCommand');
    // BU.CLIN(wc_NEB_2_TO_BW_1);

    // *    명령 요청 >>> [NEB_1_TO_NEB_2](R_CON) {GT= NEB_1.WL: 4, NEB_2.WL: 18}
    control.executeFlowControl(NEB_1_TO_NEB_2);
    wc_NEB_1_TO_NEB_2 = await eventToPromise(control, 'completeCommand');

    // * 4. 일반 증발지 1의 수위를 GT와 LLU 사이인 5로 변경.
    control.notifyDeviceData(null, [setNodeData(pn_WL_NEB_1, 5)]);
    // *  <test> 급수지로의 목표가 있는 명령이고 현재 그 명령을 달성하지 못했다면 하한선 무시
    // 여전히 명령은 실행 중
    expect(getFlowCmd(pId.NEB_1, pId.NEB_2).wrapCmdType).to.eq(reqWCT.CONTROL);
    // * 5. 일반 증발지 1의 수위를 Min인 이하인 0으로 변경
    control.notifyDeviceData(null, [setNodeData(pn_WL_NEB_1, 0)]);
    // *  <test> 장소 임계치와 목표달성 임계치가 동시에 만족할 경우 명령 취소는 1번이 정상적으로 처리
    // *    배수지 수위 최저치 >>> [NEB_1_TO_NEB_2](R_CAN)
    expect(getFlowCmd(pId.NEB_1, pId.NEB_2).wrapCmdType).to.eq(reqWCT.CANCEL);
    wc_NEB_1_TO_NEB_2 = await eventToPromise(control, 'completeCommand');

    // *  <test> 수위 하한선에 의한 자동 급수 요청
    // *    일반 증발지 1 수위 하한선 >>> [RV_TO_NEB_1](R_CON) :: 달성 목표: 급수지(일반 증발지 1) 수위 10cm 이상
    /** @type {complexCmdWrapInfo} */
    let wc_RV_TO_NEB_1 = await eventToPromise(control, 'completeCommand');

    // *    일반 증발지 1 수위 하한선 >>> [RV_TO_NEB_1](R_CON) :: 달성 목표: 급수지(일반 증발지 1) 수위 10cm 이상
    expect(getFlowCmd(pId.RV, pId.NEB_1).wrapCmdType).to.eq(reqWCT.CONTROL);

    // * 6. 해주 수위 최저치 10cm 변경, 일반 증발지 2 하한선 수위 4cm 변경
    // *  <test> 수위 하한선에 의한 배수지 탐색 시 모든 배수지가 수위 최저치 이하라면 1순위 배수지에 급수 요청
    control.notifyDeviceData(null, [setNodeData(pn_WL_BW_1, 10), setNodeData(pn_WL_NEB_2, 4)]);
    // *    일반 증발지 2 수위 하한선 >>> 배수지 수위 부족으로 인한 실패

    // * 7. 일반 증발지 1의 수위를 GT.WL UPPER 10cm 설정, 일반 증발지 2 수위 갱신
    control.notifyDeviceData(null, [setNodeData(pn_WL_NEB_1, 10)]);
    control.notifyDeviceData(null, [setNodeData(pn_WL_NEB_2, 4)]);
    // *    목표 달성 >>> [RV_TO_NEB_1](R_CAN)
    expect(getFlowCmd(pId.RV, pId.NEB_1).wrapCmdType).to.eq(reqWCT.CANCEL);
    wc_RV_TO_NEB_1 = await eventToPromise(control, 'completeCommand');

    // *  <test> 자동 급수 요청 우선 순위에 따라 급수 대상 탐색. 1순위(해주 1) 자격 미달에 의한 2순위 지역 급수 요청
    // *    수위 하한선 >>> [NEB_1_TO_NEB_2](R_CON) :: 달성 목표: 급수지(일반 증발지 2) 수위 12cm 이상
    expect(getFlowCmd(pId.NEB_1, pId.NEB_2).wrapCmdType).to.eq(reqWCT.CONTROL);
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

describe.only('염도 임계치 처리 테스트', function() {
  /**
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
   * Water Volume: WV, Available A, Current: C, Remain: R, Lower: L, Set
   * WaterLevel: WL, Salinity: S, Module Rear Temperature: MRT,
   * GoalThreshold: GT, Node: N,
   * ThresholdMinUnder: TMU, ThresholdLowerLimitUnder: TLLU, ThresholdSet: TS,
   * ThresholdUpperLimitOver: TULO, ThresholdMaxOver: TMO
   * @tutorial
   * 1. 수중태양광 증발지 그룹(DPs_2)의 염도 임계치 도달 급수지 순위 변경
   *   DPs_1.putPlaceRankList = [BW_3]
   *   DPs_2.putPlaceRankList = [BW_4,BW_3,SEA]
   * 2. DPs, WSP의 A_WV 계산(width * height * depth / 1000000000). cm3 => m3
   *  해주 2 BW_WV_TMU: 9m * 3m * 1.5m = 40.5 m3
   *  해주 3, 4 BW_WV_TMO: 4m * 3m * 1.5m = 18 m3
   *  해주 3, 4 BW_WV_TMU: 4m * 3m * 0.1m = 1.2 m3
   *  수중태양광 증발지 SEB_WV_TMO: 3.56m * 28m * 0.15m = 14.95 m3 = 15 m3
   *  수중태양광 증발지 SEB_WV_TULO: 3.56m * 28m * 0.07m = 7 m3
   *  수중태양광 증발지 SEB_WV_TS: 3.56m * 28m * 0.05m = 5 m3
   *  수중태양광 증발지 SEB_WV_TLLU: 3.56m * 28m * 0.03m = 3 m3
   *  수중태양광 증발지 SEB_WV_TMU: 3.56m * 28m * 0.01m = 1 m3
   *          수중태양광 상한선 미만 SEB_WV_TLLU: 3.56m * 28m * 0.059m = 5.88 m3
   * 3. DPs_1의 WSP인 BW_3의 수위를 140cm로 설정, DPs_1.WL = 5, DPs_1.S = 12 설정
   *  <test> DPs의 현재 염수를 30% 이상 받을 수 있는 WSP이 없을 경우 아무런 조치를 취하지 않음
   *    (SEB_WV_TS - SEB_WV_TMU) * 3 = 20 m3, BW_3_WV = 4 * 3 * (1.5-1.4) = 1.2 m3
   *  DPs_2 그룹 내의 수중 증발지인 SEP_6.S = 20
   *  <test> DPs.S_TULO(18)에 달성률이 33%이므로 명령 수행이 이루어지지 않음
   *  DPs_2.WL = 5cm, BW_4.WL = 100cm, SEP_7.S = 20
   *  <test> DPs_2.S_TULO(18)에 달성률이 66%이므로 명령 알고리즘 수행
   *  <test> DPs_2의 현재 염수량과 WSP이 허용하는 염수량의 차를 구하여 DP의 남아있는 염수량 계산
   *    DPs_2_D_A_WV = (SEB_WV_TS - SEB_WV_TMU) * 3 = (4 - 1) * 3 = 12 m3
   *    WSP_WS_A_WV = BW_WL_TMO - BW_WL_C = (4 * 3 * (1.5 - 1)) = 6 m3
   *    DPs_2_R_WV = DPs_2_D_A_WV + (SEB_TMU_WV * 3) = 6 + (1 * 3) = 9 m3
   *    DPs_2_WS_A_WV = (SEB_WV_TLLU * 3 * 1.3) - DP_R_WV = 11.7 - 9 = 2.7 m3
   *  <test> DPs_2_WL의 하한선을 기준으로 30%를 증가시킨 염수량을 공급할 수 있다면 BP의 염수량은 충분하다고 가정함
   *    BP_A_WV = BW_3_WV_C - BW_3_WV_TMU = (4 * 3 * (1.4 - 0.1)) = 15.6 m3
   *    15.6 m3 > 2.7 m3 이므로 염수 이동
   *  [SEB_6_TO_BW_4,SEB_7_TO_BW_4,SEB_8_TO_BW_4](R_CON)  ::: 달성 목표: SEB_WL_TMU
   * 4. 데이터를 초기 상태로 돌리고 명령을 취소, 해주 3의 수위를 하한선에 맞춤
   *  DPs_2.S = 10, [DPs_2_TO_BW_4](R_CAN)
   *  BW_2.WL = 20, BW_3.WL = 20, DP2_2.S = 20, 알고리즘 수행
   *  <test> BP(BW_3)의 염수가 부족하기 때문에 BP에 염수를 댈 수 있는 배급수 실행
   *    [NEB_2_TO_BW_2](R_CON)
   */
  it('염도 상한선 도달에 따른 자동 염수 이동', async () => {
    const { placeManager } = control.model;
    const {
      cmdManager,
      cmdManager: { cmdOverlapManager, threCmdManager },
    } = control.model;

    // 해주 2
    const ps_BW_2 = placeManager.findPlace(pId.BW_2);
    const pn_WL_BW_2 = ps_BW_2.getPlaceNode({ nodeDefId: ndId.WL });
    // 해주 3
    const ps_BW_3 = placeManager.findPlace(pId.BW_3);
    const pn_WL_BW_3 = ps_BW_3.getPlaceNode({ nodeDefId: ndId.WL });
    // 해주 4
    const ps_BW_4 = placeManager.findPlace(pId.BW_4);
    const pn_WL_BW_4 = ps_BW_4.getPlaceNode({ nodeDefId: ndId.WL });
    // 일반 증발지 2
    const ps_NEB_2 = placeManager.findPlace(pId.NEB_2);
    const pn_WL_NEB_2 = ps_NEB_2.getPlaceNode({ nodeDefId: ndId.WL });
    const pn_S_NEB_2 = ps_NEB_2.getPlaceNode({ nodeDefId: ndId.S });
    // 수중 증발지 1
    const ps_SEB_1 = placeManager.findPlace(pId.SEB_1);
    const pn_WL_SEB_1 = ps_SEB_1.getPlaceNode({ nodeDefId: ndId.WL });
    const pn_S_SEB_1 = ps_SEB_1.getPlaceNode({ nodeDefId: ndId.S });
    // 수중 증발지 2
    const ps_SEB_2 = placeManager.findPlace(pId.SEB_2);
    const pn_WL_SEB_2 = ps_SEB_2.getPlaceNode({ nodeDefId: ndId.WL });
    const pn_S_SEB_2 = ps_SEB_2.getPlaceNode({ nodeDefId: ndId.S });
    // 수중 증발지 3
    const ps_SEB_3 = placeManager.findPlace(pId.SEB_3);
    const pn_WL_SEB_3 = ps_SEB_3.getPlaceNode({ nodeDefId: ndId.WL });
    const pn_S_SEB_3 = ps_SEB_3.getPlaceNode({ nodeDefId: ndId.S });
    // 수중 증발지 4
    const ps_SEB_4 = placeManager.findPlace(pId.SEB_4);
    const pn_WL_SEB_4 = ps_SEB_4.getPlaceNode({ nodeDefId: ndId.WL });
    const pn_S_SEB_4 = ps_SEB_4.getPlaceNode({ nodeDefId: ndId.S });
    // 수중 증발지 5
    const ps_SEB_5 = placeManager.findPlace(pId.SEB_5);
    const pn_WL_SEB_5 = ps_SEB_5.getPlaceNode({ nodeDefId: ndId.WL });
    const pn_S_SEB_5 = ps_SEB_5.getPlaceNode({ nodeDefId: ndId.S });
    // 수중 증발지 6
    const ps_SEB_6 = placeManager.findPlace(pId.SEB_6);
    const pn_WL_SEB_6 = ps_SEB_6.getPlaceNode({ nodeDefId: ndId.WL });
    const pn_S_SEB_6 = ps_SEB_6.getPlaceNode({ nodeDefId: ndId.S });
    // 수중 증발지 7
    const ps_SEB_7 = placeManager.findPlace(pId.SEB_7);
    const pn_WL_SEB_7 = ps_SEB_7.getPlaceNode({ nodeDefId: ndId.WL });
    const pn_S_SEB_7 = ps_SEB_7.getPlaceNode({ nodeDefId: ndId.S });
    // 수중 증발지 8
    const ps_SEB_8 = placeManager.findPlace(pId.SEB_8);
    const pn_WL_SEB_8 = ps_SEB_8.getPlaceNode({ nodeDefId: ndId.WL });
    const pn_S_SEB_8 = ps_SEB_8.getPlaceNode({ nodeDefId: ndId.S });

    // * 1. 수중태양광 증발지 그룹(DPs_2)의 염도 임계치 도달 급수지 순위 변경
    const DPs_1 = [ps_SEB_1, ps_SEB_2, ps_SEB_3, ps_SEB_4, ps_SEB_5];
    const DPs_2 = [ps_SEB_6, ps_SEB_7, ps_SEB_8];
    // *   DPs_S_1.putPlaceRankList = [BW_3]
    DPs_1.forEach(dpStorage => {
      dpStorage.getPlaceNode({ nodeDefId: ndId.S }).putPlaceRankList = [pId.BW_3];
    });
    // *   DPs_S_2.putPlaceRankList = [BW_4,BW_3,SEA]
    DPs_2.forEach(dpStorage => {
      dpStorage.getPlaceNode({ nodeDefId: ndId.S }).putPlaceRankList = [
        pId.BW_4,
        pId.BW_3,
        pId.SEA,
      ];
    });

    // * 3. DPs_1의 WSP인 BW_3의 수위를 140cm로 설정, DPs_1.WL = 5, DPs_1.S = 12 설정
    control.notifyDeviceData(null, [setNodeData(pn_WL_BW_3, 14)]);
    DPs_1.forEach(dpStroage => {
      const placeNode = dpStroage.getPlaceNode({ nodeDefId: ndId.WL });
      control.notifyDeviceData(null, [setNodeData(placeNode, 5)]);
    });
    // *  <test> DPs의 현재 염수를 30% 이상 받을 수 있는 WSP이 없을 경우 아무런 조치를 취하지 않음
    // *    (SEB_WV_TS - SEB_WV_TMU) * 3 = 20 m3, BW_3_WV = 4 * 3 * (1.5-1.4) = 1.2 m3
  });
});
