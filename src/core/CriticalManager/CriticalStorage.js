const _ = require('lodash');

const { BU } = require('base-util-jh');

const CriticalManager = require('./CriticalManager');
const CriticalGoal = require('./CriticalGoal');

/**
 * 명령 달성 목표가 생성될 때 마다 객체를 생성.
 * 데이터가 갱신될 때 마다 해당 달성 목표가 처리 되었는지 확인.
 */
class CriticalStorage {
  /**
   *
   * @param {CriticalManager} criticalManager
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   */
  constructor(criticalManager, complexCmdWrapInfo) {
    this.criticalManager = criticalManager;
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
   */
  init() {
    if (_.isNumber(this.limitTimeSec)) {
      this.criticalLimitTimer = setTimeout(() => {
        // 제한 시간 초과로 달성 목표를 이루었다고 판단
        this.criticalManager.achieveGoal(this.complexCmdWrapInfo);
      }, this.limitTimeSec * 1000);
    }

    // 세부 달성 목표 설정 및 매니저 옵저버 등록
    this.criticalGoalList = this.goalDataList.map(goalInfo => new CriticalGoal(this, goalInfo));
  }

  /**
   * 세부 목표를 완료했다고 알려 올 세부 객체
   * @param {CriticalGoal} criticalGoal
   */
  notifyClear(criticalGoal) {
    let isCompleteClear = false;
    // 유일
    if (criticalGoal.isCompleteClear) {
      isCompleteClear = true;
    } else {
      isCompleteClear = _.every(this.criticalGoalList, 'isClear');
    }

    // 모든 조건이 충족되었다면 명령 해제
    isCompleteClear && this.criticalManager.achieveGoal(this.complexCmdWrapInfo);
  }
}

module.exports = CriticalStorage;
