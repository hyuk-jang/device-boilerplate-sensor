/**
 * @interface
 * 명령 달성 목표가 생성될 때 마다 객체를 생성.
 * 데이터가 갱신될 때 마다 해당 달성 목표가 처리 되었는지 확인.
 */
class CriticalComponent {
  /**
   * notifyClear을 성공하였을 경우 알릴 Successor
   * @param {CriticalComponent} criticalComponent
   */
  setSuccessor(criticalComponent) {}

  /** @param {CriticalComponent} criticalComponent */
  addComponent(criticalComponent) {}

  /** @param {CriticalComponent} criticalComponent */
  removeComponent(criticalComponent) {}

  /** @return {CriticalComponent} */
  getCriticalComponent() {}

  /**
   * 세부 목표를 완료했다고 알려 올 세부 객체
   * @param {CriticalComponent} criticalComponent
   * @return {CriticalComponent}
   */
  notifyClear(criticalComponent) {}
}

module.exports = CriticalComponent;
