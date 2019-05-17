const _ = require('lodash');

const { BU } = require('base-util-jh');

const CriticalComponent = require('./CriticalComponent');

/**
 * 명령 달성 목표가 생성될 때 마다 객체를 생성.
 * 데이터가 갱신될 때 마다 해당 달성 목표가 처리 되었는지 확인.
 */
class CriticalComposite extends CriticalComponent {
  /**
   *
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   */
  constructor(complexCmdWrapInfo) {
    super();

    /** @type {CriticalComponent[]} */
    this.children = [];

    this.complexCmdWrapInfo = complexCmdWrapInfo;

    const {
      wrapCmdId,
      wrapCmdGoalInfo: { goalDataList, limitTimeSec },
    } = complexCmdWrapInfo;

    this.id = wrapCmdId;

    this.limitTimeSec = limitTimeSec;
    this.goalDataList = goalDataList;

    this.criticalLimitTimer;
  }

  /**
   * 제한 시간이 존재한다면 SetTimer 등록 및 세부 달성 목표 개체 정의
   * @param {number} limitTimeSec
   */
  startLimiter(limitTimeSec) {
    this.criticalLimitTimer = setTimeout(() => {
      // 제한 시간 초과로 달성 목표를 이루었다고 판단
      this.achieveGoal();
    }, limitTimeSec * 1000);
  }

  /** @type {CriticalComponent} */
  addComponent(criticalComponent) {
    this.children.push(criticalComponent);
  }

  /** @type {CriticalComponent} */
  removeComponent(criticalComponent) {
    _.remove(this.children, child => _.isEqual(child, criticalComponent));
  }

  /**
   * 세부 달성 목표
   * @param {string} nodeId Node Id
   * @return {CriticalComponent}
   */
  getCriticalGoal(nodeId) {
    return _.find(this.children, { nodeId });
  }

  /**
   * 세부 목표를 완료했다고 알려 올 세부 객체
   * @param {CriticalComponent} criticalGoalLeaf
   */
  notifyClear(criticalGoalLeaf) {
    let isCompleteClear = false;
    // 유일
    if (criticalGoalLeaf.isCompleteClear) {
      isCompleteClear = true;
    } else {
      isCompleteClear = _.every(this.children, 'isClear');
    }

    // 모든 조건이 충족되었다면 명령 해제
    isCompleteClear && this.achieveGoal();
  }
}

module.exports = CriticalComposite;
