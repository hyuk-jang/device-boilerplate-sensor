const _ = require('lodash');

const { BU } = require('base-util-jh');

const CriticalGoal = require('./CriticalGoal');

/**
 * 명령 달성 목표가 생성될 때 마다 객체를 생성.
 * 데이터가 갱신될 때 마다 해당 달성 목표가 처리 되었는지 확인.
 */
class CriticalManager {
  /** @param {complexCmdWrapInfo} complexCmdWrapInfo */
  constructor(complexCmdWrapInfo) {
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
   *
   */
  init() {
    if (_.isNumber(this.limitTimeSec)) {
      this.criticalLimitTimer = setTimeout(() => {
        // 명령 실패 처리
        this.failCriticalCommand();
      }, this.limitTimeSec * 1000);
    }

    // 세부 달성 목표 설정 및 매니저 옵저버 등록
    this.criticalGoalList = this.goalDataList.map(goalInfo => new CriticalGoal(goalInfo));
    this.criticalGoalList.forEach(criGoal => criGoal.setObserver(this));
  }

  failCriticalCommand() {}

  /**
   *
   * @param {nodeInfo} nodeInfo
   */
  updateNodeInfo(nodeInfo) {}

  /**
   * 세부 목표를 완료했다고 알려 올 세부 객체
   * @param {CriticalGoal} criticalGoal
   */
  notifyClear(criticalGoal) {}
}

module.exports = CriticalManager;
