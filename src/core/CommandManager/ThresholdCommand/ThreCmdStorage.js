const _ = require('lodash');

const ThreCmdComponent = require('./ThreCmdComponent');

/**
 * 명령 달성 목표가 생성될 때 마다 객체를 생성.
 * 임계치 관리 저장소. Storage > Goal 순으로 Tree 구조를 가짐
 * 데이터가 갱신될 때 마다 해당 달성 목표가 처리 되었는지 확인.
 * 달성 목표를 완료하였거나 Timer의 동작이 진행되면 Successor에게 전파
 */
class ThreCmdStorage extends ThreCmdComponent {
  /**
   *
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   */
  constructor(complexCmdWrapInfo) {
    super();

    /** @type {CriticalComponent[]} */
    this.children = [];

    this.complexCmdWrapInfo = complexCmdWrapInfo;

    this.threCmdLimitTimer;
  }

  /**
   * notifyClear을 성공하였을 경우 알릴 Successor
   * @param {ThreCmdComponent} thresholdCommand Threshold Command Manager
   */
  setSuccessor(thresholdCommand) {
    this.successor = thresholdCommand;
  }

  /**
   * 제한 시간이 존재한다면 SetTimer 등록 및 세부 달성 목표 개체 정의
   * @param {number} limitTimeSec
   */
  startLimiter(limitTimeSec) {
    this.threCmdLimitTimer = setTimeout(() => {
      // 제한 시간 초과로 달성 목표를 이루었다고 판단
      this.successor.handleThreCmdClear(this);
    }, limitTimeSec * 1000);
  }

  /** @param {ThreCmdComponent} thresholdCommand */
  addThreCmd(thresholdCommand) {
    this.children.push(thresholdCommand);
  }

  /** @param {ThreCmdComponent} thresholdCommand */
  removeThreCmd(thresholdCommand) {
    _.remove(this.children, child => _.isEqual(child, thresholdCommand));
  }

  /**
   * 세부 목표를 완료했다고 알려 올 세부 객체
   * @param {ThreCmdComponent} thresholdCommandGoal
   * @return {ThreCmdComponent}
   */
  handleThreCmdClear(thresholdCommandGoal) {
    let isCompleteClear = false;
    // 유일
    if (thresholdCommandGoal.isCompleteClear) {
      isCompleteClear = true;
    } else {
      isCompleteClear = _.every(this.children, 'isClear');
    }

    // 모든 조건이 충족되었다면 Successor에게 임계치 명령 달성 처리 의뢰
    if (isCompleteClear) {
      // this.threCmdLimitTimer && clearTimeout(this.threCmdLimitTimer);
      this.successor.handleThreCmdClear(this);
    }
  }
}
module.exports = ThreCmdStorage;
