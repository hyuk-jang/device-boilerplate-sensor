/* eslint-disable camelcase */
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

const ndId = {
  S: 'salinity',
  WL: 'waterLevel',
  BT: 'brineTemperature',
  MRT: 'moduleRearTemperature',
};

const pId = {
  NEB_1: 'NEB_1',
  NEB_2: 'NEB_2',
  SEB_1: 'SEB_1',
  SEB_2: 'SEB_2',
  BW_1: 'BW_1',
  BW_2: 'BW_2',
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

describe('Automatic Mode', function() {
  this.timeout(5000);

  before(async () => {
    await control.init(dbInfo, config.uuid);
    control.runFeature();

    // control.changeControlMode(controlModeInfo.AUTOMATIC);

    control.model.cmdManager.changeCmdStrategy(1);

    control.inquiryAllDeviceStatus();
    await eventToPromise(control, 'completeInquiryAllDeviceStatus');
  });

  beforeEach(async () => {
    try {
      control.model.cmdManager.changeCmdStrategy(0);
      // control.controlModeUpdator.controlMode = controlModeInfo.MANUAL;
      control.executeSetControl({
        wrapCmdId: 'closeAllDevice',
        wrapCmdType: reqWrapCmdType.CONTROL,
      });
      await eventToPromise(control, 'completeCommand');
    } catch (error) {
      BU.error(error.message);
    }

    BU.CLI('왓?')
    control.model.cmdManager.changeCmdStrategy(1);

    // control.changeControlMode(controlModeInfo.AUTOMATIC);

    const { placeManager } = control.model;
  });

  /**
   * @desc T.C 1 [자동 모드]
   * 염수 이동 기본 요건 충족 체크. 배수지 수위(최저치 초과), 급수지 수위(최대치 미만).
   * @description
   * 1. Map에 설정되어 있는 모든 장소의 임계치를 등록하고 초기화 한다.
   * 2. 결정지 2의 수위를 Max값(10cm)으로 설정하고 해주 5의 수위를 Min값(10cm)으로 설정
   * 3. [해주 5 > 결정지 ] 명령 요청. X
   * 4. 결정지 의 수위를 Set값(5cm), 해주 5의 수위를 (130cm) 설정
   * 5. [해주 5 > 결정지 ] 명령 요청. O
   * 6. 결정지의 수위를 Max값 이상(15cm) 설정. [해주 5 > 결정지 ] 명령 취소 처리 확인
   *    급수지의 상한선 수위가 걸렸을 경우 진행 중인 급수 명령을 취소하는지 테스트
   * 7. 결정지의 수위를 Set값(5cm) 설정.
   * 8. [해주 5 > 결정지 ] 명령 요청. O :: 달성 목표: 배수지 수위 4cm 이하, 달성 제한 시간: 2 Sec
   * 9. 해주 1의 수위를 Min(10cm) 설정. [해주 5 > 결정지 ] 진행 중 명령 삭제 및 임계 명령 삭제 확인
   *    배수지 하한선 수위가 걸렸을 경우 진행 중인 배수 명령을 취소하는지 테스트
   */
  it.only('급배수지 수위 최저, 최대치에 의한 명령 처리', async () => {
    const { placeManager } = control.model;
    const {
      cmdManager,
      cmdManager: { cmdOverlapManager, threCmdManager },
    } = control.model;

    expect(cmdOverlapManager.getExistOverlapStatusList()).to.length(0);

    // BU.CLIN(placeManager);

    // 결정지
    const ps_NCB = placeManager.findPlace('NCB');
    const pn_WL_NCB = ps_NCB.getPlaceNode({ nodeDefId: ndId.WL });
    // 해주 5
    const ps_BW_5 = placeManager.findPlace('BW_5');
    const pn_WL_BW_5 = ps_BW_5.getPlaceNode({ nodeDefId: ndId.WL });

    // * 2. 배수지(해주 5)의 수위를 Min(10cm), 급수지(결정지)의 수위를 Max 11cm 으로 설정
    control.notifyDeviceData(null, [setNodeData(pn_WL_BW_5, 10), setNodeData(pn_WL_NCB, 11)]);

    // * 3. [해주 5 > 결정지 ] 명령 요청. X
    /** @type {reqFlowCmdInfo} 증발지 1-A > 해주 1 */
    const BW5ToNCB = {
      srcPlaceId: 'BW_5',
      destPlaceId: 'NCB',
      wrapCmdType: reqWrapCmdType.CONTROL,
    };
    // 배수지의 수위가 최저 수위 이하라서 수행 불가
    expect(() => control.executeFlowControl(BW5ToNCB)).to.throw(
      'The water level of the srcPlaceId: BW_5 is below the minimum water level',
    );

    // 해주 5의 수위를 (130cm) 설정
    control.notifyDeviceData(null, [setNodeData(pn_WL_BW_5, 130)]);

    // 급수지 (NCB) 의 수위가 최대 수위 이상이라서 수행 불가
    expect(() => control.executeFlowControl(BW5ToNCB)).to.throw(
      'The water level of the destPlaceId: NCB is over the max water level.',
    );

    // * 4. 결정지 의 수위를 Set값(5cm)
    control.notifyDeviceData(null, [setNodeData(pn_WL_NCB, 5)]);

    // * 5. [해주 5 > 결정지 ] 명령 요청. O
    control.executeFlowControl(BW5ToNCB);

    /** @type {complexCmdWrapInfo} */
    const BW_5_To_NCB_WC_CONTROL = await eventToPromise(control, 'completeCommand');

    // * trueNodeList: ['P_014'],
    expect(cmdOverlapManager.getExistSimpleOverlapList(TRUE)).to.length(1);
    // * falseNodeList: ['WD_008'],
    expect(cmdOverlapManager.getExistSimpleOverlapList(FALSE)).to.length(1);

    // * 6. 결정지의 수위를 Max값 이상(15cm) 설정. [해주 5 > 결정지 ] 명령 취소 처리 확인
    control.notifyDeviceData(null, [setNodeData(pn_WL_NCB, 15)]);

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

    // * 7. 결정지의 수위를 Set값(5cm) 설정.
    control.notifyDeviceData(null, [setNodeData(pn_WL_NCB, 5)]);

    expect(cmdOverlapManager.getExistOverlapStatusList()).to.length(0);

    // FIXME: 취소 요청 중에 Control 요청이 들어갈 경우 실제 제어할 장치와의 상태 위반에 걸리기 때문에 명령이 씹힘.
    // 어떻게 처리할지 생각 필요.
    /** @type {complexCmdWrapInfo} */
    const BW_5_To_NCB_WC_CANCEL = await eventToPromise(control, 'completeCommand');

    expect(BW_5_To_NCB_WC_CONTROL.wrapCmdId).to.eq(BW_5_To_NCB_WC_CANCEL.wrapCmdId);

    // * 8. [해주 5 > 결정지 ] 명령 요청. O :: 달성 목표: 배수지 수위 4cm 이상, 달성 제한 시간: 2 Sec
    BW5ToNCB.wrapCmdGoalInfo = {
      limitTimeSec: 2,
      goalDataList: [
        {
          nodeId: 'WL_016',
          goalValue: 4,
          goalRange: goalDataRange.UPPER,
        },
      ],
    };

    const wrapCmdInfo = control.executeFlowControl(BW5ToNCB);

    // 명령이 완료되기를 기다림
    await eventToPromise(control, 'completeCommand');

    // 임계 명령이 존재해야 한다.
    const threCmdInfo = threCmdManager.getThreCmdStorage(wrapCmdInfo);
    const threCmdGoalInfo = threCmdInfo.getThreCmdGoal('WL_016');

    // 수위 16번 임계 목표가 설정되어야 한다.
    expect(threCmdGoalInfo.threCmdGoalId).to.eq('WL_016');
    expect(threCmdManager.threCmdStorageList).to.length(1);

    // * 9. 해주 1의 수위를 Min(10cm) 설정. [해주 5 > 결정지 ] 진행 중 명령 삭제 및 임계 명령 삭제 확인
    control.notifyDeviceData(null, [setNodeData(pn_WL_BW_5, 10)]);

    await eventToPromise(control, 'completeCommand');

    // 명령은 취소 처리 되었음.
    expect(cmdManager.getComplexCommand(wrapCmdInfo.wrapCmdId)).to.undefined;
    // 임계 명령은 제거되어야 한다.
    expect(threCmdManager.threCmdStorageList).to.length(0);
    // 현재 실행 중인 명령은 없음.
    expect(cmdManager.complexCmdList).to.length(0);
    // 누적 호출을 지닌 노드는 없음.
    expect(cmdOverlapManager.getExistOverlapStatusList()).to.length(0);
  });

  it('급배수지 수위 최저, 최대치에 의한 명령 처리', async () => {
    const { placeManager } = control.model;
    const { cmdOverlapManager, threCmdManager } = control.model.cmdManager;

    // BU.CLIN(placeManager);

    // 일반 증발지 2
    const ps_NEB_2 = placeManager.findPlace('NEB_2');
    const pn_S_NEB_2 = ps_NEB_2.getPlaceNode({ nodeDefId: ndId.S });
    const pn_WL_NEB_2 = ps_NEB_2.getPlaceNode({ nodeDefId: ndId.WL });

    // 해주 1
    const ps_BW_1 = placeManager.findPlace('BW_1');
    const pn_WL_BW_1 = ps_NEB_2.getPlaceNode({ nodeDefId: ndId.WL });

    // 해주 2
    const ps_BW_2 = placeManager.findPlace('BW_2');
    const pn_WL_BW_2 = ps_NEB_2.getPlaceNode({ nodeDefId: ndId.WL });

    // 수중태양광 증발지 1
    const ps_SEB_1 = placeManager.findPlace('SEB_1');
    const pn_WL_SEB_1 = ps_SEB_1.getPlaceNode({ nodeDefId: ndId.WL });
    const pn_S_SEB_1 = ps_SEB_1.getPlaceNode({ nodeDefId: ndId.S });
    const pn_MRT_SEB_1 = ps_SEB_1.getPlaceNode({ nodeDefId: ndId.MRT });

    // 수로 8번
    const ps_WW_008 = placeManager.findPlace('WW_008');

    expect(ps_SEB_1.getPlaceId()).to.eq('SEB_1');
    // 일반 증발지 2 염도 상한선 6도
    expect(pn_S_NEB_2.getUpperLimitValue()).to.eq(6);
    // 일반 증발지 2 수위 하한선 8cm
    expect(pn_WL_NEB_2.getLowerLimitValue()).to.eq(8);

    expect(ps_WW_008.getPlaceId()).to.eq('WW_008');
    // 면적: width: 33 m, height: 10m --> 330m2
    expect(ps_NEB_2.getSquareMeter()).to.eq(330);

    // 면적: width: 3.56 m, height: 28m --> 99.7m2
    expect(ps_SEB_1.getSquareMeter()).to.eq(99.7);
    // 면적이 없는 경우는 undefined 반환
    expect(ps_WW_008.getSquareMeter()).to.undefined;
  });

  /**
   * @desc T.C 2 [자동 모드] :::
   * 수위 임계치에 의한 우선 순위 염수 이동 명령 자동 생성 및 취소
   * @description
   * 장소 임계치에 의한 흐름 명령 생성은 무조건 Goal이 존재
   * Goal이 존재할 경우 [최대치, 최저치]에 명령 생성 및 취소
   * Goal이 존재하지 않을 경우 [최대치, 상한선, 하한선, 최저치]에 명령 생성 및 취소
   * @tutorial
   * 1. Map에 설정되어 있는 모든 장소의 임계치를 등록하고 초기화 한다.
   *  <test> Goal이 존재할 경우 최저치에 의한 명령 취소
   * 1. NEB_2: MIN(2)
   *
   * 2. [NEB_2_TO_BW_2](R_CON->C_CON). {Goal} WL 1cm
   *
   *
   * 4. <test> Goal이 존재할 경우 최저치에 의한 명령 취소
   * 일반 증발지 2의 수위를 Min 이하 1.5cm
   *    최저치 수위 임계치 처리 후 수위 하한선 처리 자동 요청으로 인한 염수 이동 명령 발생
   *    수위 최저치 >>> [NEB_2_TO_BW_2](R_CAN)
   *    수위 하한선 >>> [BW_1_TO_NEB_2](R_CON)
   * 4. 해주 1 수위 5cm로 설정
   *    해주 1 수위 최저치 >>> [BW_1_TO_NEB_2](R_CAN){R_CON무시}
   *    우선 수위는 해주 1이 높으나 염수 부족으로  2 순위 일반 증발지 1 배수지 선택
   *    일반 증발지 2 수위 하한선  >>> [NEB_1_TO_NEB_2](R_CON)
   *    수위 하한선 >>> Empty
   * 5. [NEB_2_TO_BW_2](C_CAN), [BW_1_TO_NEB_2](C_CAN), [NEB_1_TO_NEB_2](C_CON) 명령 완료 Await
   * 6. 일반 증발지 2 설정 수위 12cm 설정
   *    [NEB_1_TO_NEB_2](R_CAN->C_CAN)
   * 7. <test_상한선_명령_취소>
   *    [NEB_1_TO_NEB_2](R_CON). 달성 목표: 일반 증발지 2 수위 상한선(12cm) 이상
   *    배수지 우선 순위 1인 해주 1의 수위가 충족되나 명령 충돌로 인한 염수 이동 명령 불가 확인
   * 6. 일반 증발지 2 수위 12cm 설정. 명령 취소 처리 확인.
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

    // * 2. [NEB_2_To_BW_2] 달성 목표: NEB_2 수위 1cm 이상
    /** @type {reqFlowCmdInfo} */
    const NEB_2_To_BW_2 = {
      srcPlaceId: 'NEB_2',
      destPlaceId: 'BW_2',
      wrapCmdType: reqWrapCmdType.CONTROL,
      wrapCmdGoalInfo: {
        goalDataList: [
          {
            nodeId: placeManager.findPlace('NEB_2').getNodeId(ndId.WL),
            goalValue: 1,
            goalRange: goalDataRange.UPPER,
          },
        ],
      },
    };
    // 2. [NEB_2_To_BW_2] Request
    control.executeFlowControl(NEB_2_To_BW_2);

    /** @type {complexCmdWrapInfo} */
    // Process CMD : [NEB_2_To_BW_2 CONTROL]
    // Running CMD : []
    const controlWrapCmdInfo = await eventToPromise(control, 'completeCommand');
    // Process CMD : []
    // Running CMD : [NEB_2_To_BW_2]

    expect(controlWrapCmdInfo.srcPlaceId).to.eq(pId.NEB_2);
    expect(controlWrapCmdInfo.destPlaceId).to.eq(pId.BW_2);

    // * 3. 일반 증발지 2의 수위를 Min 이하 1.5cm, 해주 1 수위 5cm로 설정
    // *    달성 목표보다 일반 증발지 Min 값의 우선 순위가 크기 때문에 수위 최저치로 인한 명령 취소.
    const ps_NEB_1 = placeManager.findPlace(pId.NEB_1);
    const pn_WL_NEB_1 = ps_NEB_1.getPlaceNode({ nodeDefId: ndId.WL });

    const ps_NEB_2 = placeManager.findPlace(pId.NEB_2);
    const pn_WL_NEB_2 = ps_NEB_2.getPlaceNode({ nodeDefId: ndId.WL });

    const ps_BW_1 = placeManager.findPlace(pId.BW_1);
    const pn_WL_BW_1 = ps_BW_1.getPlaceNode({ nodeDefId: ndId.WL });

    // 일반 증발지 2 수위 1.5cm 설정
    control.notifyDeviceData(null, [setNodeData(pn_WL_NEB_2, 1.5)]);

    // handleMinUnder --> 'NEB_2'
    expect(getFlowCmd(pId.NEB_2, pId.BW_2).wrapCmdType).to.eq(reqWrapCmdType.CANCEL);
    // handleLowerLimitUnder -->  'NEB_2'
    expect(getFlowCmd(pId.BW_1, pId.NEB_2).wrapCmdType).to.eq(reqWrapCmdType.CONTROL);

    // await eventToPromise(control, 'completeCommand');

    // await Promise.delay(1000);

    // 해주 1 수위 5cm로 설정
    control.notifyDeviceData(null, [setNodeData(pn_WL_BW_1, 5)]);
    // handleMinUnder --> 'BW_1'
    expect(getFlowCmd(pId.BW_1, pId.NEB_2).wrapCmdType).to.eq(reqWrapCmdType.CANCEL);
    // handleMinUnder --> 'NEB_2'
    // handleLowerLimitUnder --> 'NEB_2'
    expect(getFlowCmd(pId.NEB_1, pId.NEB_2).wrapCmdType).to.eq(reqWrapCmdType.CONTROL);
    // handleLowerLimitUnder --> 'BW_1'
    //    *    수위 하한선 >>> Empty

    // * 5. [NEB_2_TO_BW_2](CAN), [BW_1_TO_NEB_2](CAN), [NEB_1_TO_NEB_2](RUN) 명령 완료 Await
    await eventToPromise(control, 'completeCommand');
    await eventToPromise(control, 'completeCommand');
    await eventToPromise(control, 'completeCommand');

    // 현재 RUNNING 명령 [NEB_1_TO_NEB_2]
    expect(getFlowCmd(pId.NEB_1, pId.NEB_2).wrapCmdStep).to.eq(complexCmdStep.RUNNING);
    // 누적 명령 테스트 [NEB_1 Drainage WD 2개]
    expect(cmdOverlapManager.getExistSimpleOverlapList(TRUE)).to.length(2);
    // 누적 명령 테스트 [NEB_2 Drainage WD 2개]
    expect(cmdOverlapManager.getExistSimpleOverlapList(FALSE)).to.length(2);

    BU.CLI(pn_WL_NEB_2.getThresholdValue());

    // control.notifyDeviceData(null, [setNodeData(pn_WL_NEB_2, )]);

    // handleLowerLimitUnder -->  'BW_1' :::   wrapCmdId: 'NEB_1_TO_NEB_2', wrapCmdType: 'CONTROL'
    // control.notifyDeviceData(null, [setNodeData(pn_WL_NEB_2, 1.5), setNodeData(pn_WL_BW_1, 5)]);

    // control.notifyDeviceData(null, [setNodeData(pn_WL_NEB_1, 5)]);

    // BU.CLIS(cmdManager.complexCmdList);

    // /** @type {complexCmdWrapInfo} 명령 취소 처리 됨 */
    // const cancelWrapCmdInfo = await eventToPromise(control, 'completeCommand');
    // BU.CLIN(cancelWrapCmdInfo);
    // expect(controlWrapCmdInfo.wrapCmdId).to.eq(cancelWrapCmdInfo.wrapCmdId);

    // 명령 취소가 되고 추가 염수 명령이 발생해야함.

    // * 4. 최저치 수위 임계치 처리 후 수위 하한선 처리 자동 요청으로 인한 염수 이동 명령 발생
    // *    우선 수위는 해주 1이 높으나 염수 부족으로  2 순위 일반 증발지 1 배수지 선택
    // *    [일반 증발지 1 > 일반 증발지 2] 명령 요청. 달성 목표: 일반 증발지 2 수위 12cm 이상

    // * 5. 해주 1 수위 150 cm, 해주 2의 수위 1.6cm 설정. 해주 2 하한선 임계치 재발생
    // *    배수지 우선 순위 1인 해주 1의 수위가 충족되나 명령 충돌로 인한 염수 이동 명령 불가 확인
    // * 6. 일반 증발지 2 수위 12cm 설정. 명령 취소 처리 확인.

    // * 2. 우선 순위가 해주 1이 높기 때문에 [해주 1 > 일반 증발지 1] 명령 요청. 달성 목표: 수위 12cm
    // expect(cmdManager.getFlowCommand('', 'NEB_2')).to.length(1);

    // 우선 순위가 해주 1이 높기 때문에 [해주 1 > 일반 증발지 1] 명령 요청. 달성 목표: 수위 12cm

    // * 3. 일반 증발지 1의 수위를 12cm로 설정. 명령 완료 확인
    // * 4. 일반 증발지 2 수위 2cm, 해주 1 수위 20cm 설정. 해주 1의 염수가 부족하기 때문에 [일반 증발지 2 > 일반 증발지 1] 명령 요청. 달성 목표: 수위 12cm
    // * 5. 일반 증발지 1 수위 2cm 설정. [일반 증발지 2 > 일반 증발지 1] 명령 취소 확인
    // * 6. [저수지 > 일반 증발지 1] 명령 요청. 달성 목표: 수위 10cm
    // * 7. 일반 증발지 2 수위 12cm 설정. [저수지 > 일반 증발지 1] 명령 완료 확인
    // * 8. [일반 증발지 2 > 일반 증발지 1] 명령 요청 확인
  });

  /**
   * @desc T.C 3 [자동 모드]
   * 염도 임계치에 의한 염수 이동
   * @description
   * 0. Map에 설정되어 있는 모든 장소의 임계치를 등록하고 초기화. 설정 값은 set 값 범위에 오도록 함.(Echo)
   * 1. SEB_6 염도 20%. BW_3 수위 150cm 설정.
   *    수중 증발지 그룹 2 면적 3.56 * 28 * 3  은 299m2, Min과 Set의 차이값은 4cm. 따라서 필요 부피 11.96m3
   *    BW_3의 면적 4m * 3m = 12m2, lowerLimit 20cm이고 Set은 150cm이므로 130cm. 사용가능 부피 15.6m3
   *   [SEB_6 ~ SEB_8 > BW_4] 명령 요청. 달성 목표: 수위 1cm
   * 2. SEB_6 ~ SEB_8 의 수위 순차적으로 0.5cm 로 변경. 단계적 명령 완료 확인
   * 3. SEB_6 ~ SEB_8 수위 5cm, 염도 20%, BW_3 수위 60cm 변경.
   *    부피가 부족하므로 [SEB_1 ~ SEB_5 > BW_3] 명령 요청. 달성 목표: 수위 1cm
   * 4. SEB_1 ~ SEB_5 의 수위 순차적으로 0.5cm 로 변경. 단계적 명령 완료 확인
   * 5.
   */

  /**
   * @desc T.C 3 [자동 모드]
   *
   * @description
   * 1. 일반 증발지 2의 염수 수위
   * 2.
   */

  // * 해주 및 증발지의 면적에 따른 해수 부피를 산정하여 명령 수행 가능성 여부를 결정한다.
});

describe.skip('100kW급 명령 테스트', function() {
  it('바다, 저수지, 일반 증발지 1~2', async () => {});
});
