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
  RV_1: 'RV_1',
  RV_2: 'RV_2',
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
  SCENARIO: 'SCENARIO',
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

describe('우천 모드 테스트', function() {
  this.timeout(5000);

  before(async () => {
    await control.init(dbInfo, config.uuid);
    control.runFeature();

    coreFacade.updateControlMode(controlMode.SCENARIO);

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
   * 1. 'closeAllDevice' Set 명령 요청 [Step_1]ㄴㄴ
   *  <test> Set 명령 정상적으로 수행 여부
   *  <test> MSC 동기 처리 여부 >>> 명령 수행 중 [Step_2]로 넘어가지 않는지 여부
   *  <test> Goal이 없는 명령일 경우 장치 제어 완료 후 명령 Stack에서 제거 여부
   * 2. 염수 대피 [Step_2]
   *  <test> SSC 비동기 처리 여부 >>> 결정지 염수 이동, 수중 태양광 증발지 그룹 2, 1 염수 이동, 일반 증발지 염수 이동 동시 실행 여부
   *  [NCB_TO_BW_5](R_CON), [SEB_TWO_TO_BW_3](R_CON), [SEB_ONE_TO_BW_2](R_CON), [NEB_2_TO_BW_1](R_CON), [NEB_1_TO_SEA](R_CON)
   *  <test> Goal 없는 Flow 명령 완료 시 삭제 여부
   *    명령 완료 >>> [NEB_1_TO_SEA](DEL)
   *  NCB_TO_BW_5 명령 Goal 인 NCB.WL = 1
   *  <test> FLOW 명령. Single 설정 목표 달성으로 인한 ESC 명령 Stack 제거 및 Next ESC 명령 요청
   *    목표 달성 >>> [NCB_TO_BW_5](R_CAN), [NCB_TO_SEA](R_CON) >>> [NCB_TO_SEA](DEL)
   *  SEB_6.WL = 1, SEB_7.WL = 1, SEB_7.WL = 1 순차적으로 실행.
   *  <test> Flow 명령. Multi 설정 목표 달성으로 인한 ESC 명령 Stack 제거 및 Next ESC 명령 요청
   *    수중 태양광 증발지 그룹 2 목표 수위 달성 >>> [SEB_TWO_TO_BW_3](R_CAN)
   *  [SEB_TWO_TO_SEA](R_CON) >>> [SEB_TWO_TO_SEA](DEL)
   *  BW_2.WL = 150. 급수지 수위 최대치에 의한 명령 취소
   *  <test> Flow 명령. 급수지 수위 최대치에 의한 명령 취소 여부
   *    급수지 수위 최대치 >>> [SEB_ONE_TO_BW_2](R_CAN)
   *  NEB_2.WL = 1
   *    목표 달성 >>> [NEB_2_TO_BW_1](R_CAN)
   *  <test> [Step_2] All SSC 명령 완료 후 Next MSC 진행 여부
   * 3. 바다로 ~ [Step_3]
   *    'rainMode' Set 명령 실행 여부
   */
  it('우천 모드', () => {});
});
