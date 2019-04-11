const _ = require('lodash');

const {
  MaxOverState,
  UpperLimitOverState,
  NormalState,
  LowerLimitUnderState,
  MinUnderState,
  UnknownState,
} = require('./AbstCriticalState');

class AbstCriticalManager {
  /**
   * @param {MainControl} controller
   * @param {mCriticalControlInfo} criticalControlInfo
   */
  constructor(controller, criticalControlInfo = {}) {
    this.controller = controller;
    const {
      ndId,
      maxValue,
      upperLimitValue,
      setValue,
      lowerLimitValue,
      minValue,
      callPlaceRankList,
      putPlaceRankList,
    } = criticalControlInfo;

    this.ndId = ndId;
    this.maxValue = maxValue;
    this.upperLimitValue = upperLimitValue;
    this.setValue = setValue;
    this.lowerLimitValue = lowerLimitValue;
    this.minValue = minValue;
    this.callPlaceRankList = callPlaceRankList;
    this.putPlaceRankList = putPlaceRankList;
  }

  init() {
    // State 객체 생성
    this.initState();
    /** 장치 데이터가 갱신된 현재 상태 */
    this.currState = this.unknownState;
    // 상태가 변경되기 전 상태. currState와의 값이 틀리다면 Update 명령을 수행하지 않은 것으로 판단
    this.prevState = this.unknownState;
  }

  /**
   * @abstract
   * State 객체를 생성
   */
  initState() {
    this.maxOverState = new MaxOverState();
    this.upperLimitOverState = new UpperLimitOverState();
    this.normalState = new NormalState();
    this.lowerLimitUnderState = new LowerLimitUnderState();
    this.minUnderState = new MinUnderState();
    this.unknownState = new UnknownState();
  }

  /**
   * @desc Bridge Pattern
   * @param {Object} stateInfo
   * @param {MaxOverState=} stateInfo.MaxOverState
   * @param {UpperLimitOverState=} stateInfo.UpperLimitOverState
   * @param {NormalState=} stateInfo.NormalState
   * @param {LowerLimitUnderState=} stateInfo.LowerLimitUnderState
   * @param {MinUnderState=} stateInfo.MinUnderState
   * @param {UnknownState=} stateInfo.UnknownState
   */
  bindingState(stateInfo) {
    // 재정의 요청한 Class State 만큼 재설정
    _.forEach(stateInfo, (bindingState, stateClassName) => {
      _.set(this, stateClassName, bindingState);
    });
  }

  initValue() {}

  /**
   * 갱신된 데이터가 임계치에 걸리는지 체크 후 스테이트 변경
   * @param {string|number} deviceData
   */
  updateValue(deviceData) {
    let currState;
    if (_.isNumber(deviceData)) {
      currState = this.updateNumValue(deviceData);
    } else if (_.isString(deviceData)) {
      currState = this.checkUpdateStrValue(deviceData);
    }

    // 이전 State와 비교 후 같은 상태가 아니라면 현재 상태를 이전 상태로 옮기고 업데이트 된 상태를 현재 상태로 정의
    if (!_.eq(this.currState, currState)) {
      this.prevState = this.currState;
      this.currState = currState;

      // 상태가 변경되었으로 갱신 명령을 요청
      this.currState.changedState();
    }
  }

  /**
   * @param {number} numDeviceData number 형식 데이터
   */
  updateNumValue(numDeviceData) {
    let currState;

    if (!_.isNumber(numDeviceData)) {
      currState = this.unknownState;
    } else if (_.isNumber(this.maxValue) && numDeviceData >= this.maxValue) {
      currState = this.maxOverState;
    } else if (_.isNumber(this.upperLimitValue) && numDeviceData >= this.upperLimitValue) {
      currState = this.upperLimitOverState;
    } else if (_.isNumber(this.minValue) && numDeviceData <= this.minValue) {
      currState = this.minUnderState;
    } else if (_.isNumber(this.lowerLimitValue) && numDeviceData <= this.lowerLimitValue) {
      currState = this.lowerLimitUnderState;
    } else {
      currState = this.normalState;
    }
    return currState;
  }

  /**
   * @abstract string 일 경우에는 개별 처리
   * @param {string} strDeviceData string 형식 데이터
   */
  checkUpdateStrValue(strDeviceData = '') {}
}

module.exports = AbstCriticalManager;
