const _ = require('lodash');

class CriticalState {
  /**
   * @interface
   * 갱신된 상태에 대한 명령 요청
   */
  requestCommand() {}
}

const MaxOverState = class extends CriticalState {};
const UpperLimitOverState = class extends CriticalState {};
const NormalState = class extends CriticalState {};
const LowerLimitUnderState = class extends CriticalState {};
const MinUnderState = class extends CriticalState {};
const UnknownState = class extends CriticalState {};

class CriticalManager {
  /**
   *
   * @param {mCriticalControlInfo} criticalControlInfo
   */
  constructor(criticalControlInfo = {}) {
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

    this.MaxOverState = MaxOverState;
    this.UpperLimitOverState = UpperLimitOverState;
    this.NormalState = NormalState;
    this.LowerLimitUnderState = LowerLimitUnderState;
    this.MinUnderState = MinUnderState;
    this.UnknownState = UnknownState;

    /** 장치 데이터가 갱신된 현재 상태 */
    this.currState = new this.UnknownState();
    // 상태가 변경되기 전 상태. currState와의 값이 틀리다면 Update 명령을 수행하지 않은 것으로 판단
    this.prevState = new this.UnknownState();
  }

  init() {}

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
      this.currState.requestCommand();
    }
  }

  /**
   * @param {number} numDeviceData number 형식 데이터
   */
  updateNumValue(numDeviceData) {
    let currState;

    if (!_.isNumber(numDeviceData)) {
      currState = new this.UnknownState();
    } else if (_.isNumber(this.maxValue) && numDeviceData >= this.maxValue) {
      currState = new this.MaxOverState();
    } else if (_.isNumber(this.upperLimitValue) && numDeviceData >= this.upperLimitValue) {
      currState = new this.UpperLimitOverState();
    } else if (_.isNumber(this.minValue) && numDeviceData <= this.minValue) {
      currState = new this.MinUnderState();
    } else if (_.isNumber(this.lowerLimitValue) && numDeviceData <= this.lowerLimitValue) {
      currState = new this.LowerLimitUnderState();
    } else {
      currState = new this.NormalState();
    }
    return currState;
  }

  /**
   * @abstract string 일 경우에는 개별 처리
   * @param {string} strDeviceData string 형식 데이터
   */
  checkUpdateStrValue(strDeviceData = '') {}
}

module.exports = {
  CriticalManager,
  CriticalState,
  MaxOverState,
  UpperLimitOverState,
  NormalState,
  LowerLimitUnderState,
  MinUnderState,
  UnknownState,
};
