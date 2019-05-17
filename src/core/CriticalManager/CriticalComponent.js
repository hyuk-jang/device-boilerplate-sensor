const _ = require('lodash');

const { BU } = require('base-util-jh');

const CriticalManager = require('./CriticalManager');
const CriticalGoal = require('./CriticalGoal');

/**
 * @interface
 * 명령 달성 목표가 생성될 때 마다 객체를 생성.
 * 데이터가 갱신될 때 마다 해당 달성 목표가 처리 되었는지 확인.
 */
class CriticalComponent {
  /**
   * 제한 시간이 존재한다면 SetTimer 등록 및 세부 달성 목표 개체 정의
   */
  init() {}

  startLimiter() {}

  addComponent() {}

  removeComponent() {}

  /**
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {CriticalComponent}
   */
  getCriticalGoal(complexCmdWrapInfo) {}

  achieveGoal() {}

  /**
   * 세부 목표를 완료했다고 알려 올 세부 객체
   * @param {CriticalComponent} criticalGoal
   */
  notifyClear(criticalGoal) {}
}

module.exports = CriticalComponent;
