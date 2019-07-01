const Observer = require('../../Updator/Observer');

/**
 * @interface
 * 명령 달성 목표가 생성될 때 마다 객체를 생성.
 * 데이터가 갱신될 때 마다 해당 달성 목표가 처리 되었는지 확인.
 */
class ThreCmdComponent extends Observer {
  /** 데이터 목표 기준치 범위  */
  static get goalDataRange() {
    return {
      /** 기준 값 초과 */
      UPPER: 'UPPER',
      /** 기준 값 동일 */
      EQUAL: 'EQUAL',
      /** 기준 값 이하  */
      LOWER: 'LOWER',
    };
  }

  /**
   * notifyClear을 성공하였을 경우 알릴 Successor
   * @param {ThreCmdComponent} thresholdCommand
   */
  setSuccessor() {}

  /** @param {ThreCmdComponent} thresholdCommand */
  addThreCmdGoal(thresholdCommand) {}

  /** @param {ThreCmdComponent} thresholdCommand */
  removeThreCmdGoal(thresholdCommand) {}

  /**
   * 임계치 저장소를 조회하고자 할 경우
   * @param {string} nodeId Node ID
   * @return {ThreCmdComponent}
   */
  getThreCmdGoal(nodeId) {}

  /**
   * 저장소에 연결된 임계치 목표 객체 목록 반환
   * @return {ThreCmdComponent[]}
   */
  get threCmdGoalList() {
    return [];
  }

  /**
   * 저장소에 연결된 임계치 목표 객체 Node ID 반환
   * @return {string} nodeId
   */
  get threCmdGoalId() {
    return '';
  }

  /**
   * @return {boolean} 임계 명령 완료 여부
   */
  isThreCmdClear() {}

  /**
   * 세부 목표를 완료했다고 알려 올 세부 객체
   * @param {ThreCmdComponent} thresholdCommand
   * @return {ThreCmdComponent}
   */
  handleThreCmdClear(thresholdCommand) {}
}
module.exports = ThreCmdComponent;
