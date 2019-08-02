class ScenarioComponent {
  /**
   * handleScenarioClear 성공하였을 경우 알릴 Successor
   * @param {ScenarioComponent} scenarioComponent
   */
  setSuccessor(scenarioComponent) {}

  /** 실행 중인 명령 Id 반환 */
  getWrapCmdId() {}

  /**
   * 시나리오가 완료되었다고 판단
   * @param {string} wrapCmdId
   */
  updateScenarioClear(wrapCmdId) {}

  getIsSync() {}

  /** @param {ScenarioComponent} scenarioComponent */
  addScenario(scenarioComponent) {}

  /** @param {ScenarioComponent} scenarioComponent */
  removeScenario(scenarioComponent) {}

  /**
   * 실행중인 시나리오를 반환
   * @return {ScenarioComponent|ScenarioComponent[]}
   */
  getRunningScenario() {}

  /**
   * 현재 시나리오 명령 완료 여부
   * @return {boolean}
   */
  isScenarioClear() {}

  /** 시나리오 명령 실행 */
  executeScenario() {}

  /** 시나리오 명령 취소 */
  cancelScenario() {}

  /** @param {ScenarioComponent} scenarioComponent */
  handleScenarioClear(scenarioComponent) {}

  /**
   * 시나리오 명령을 실행하는 과정에서 문제가 생길 경우 전체 더이상 실행하지 않음
   * @param {ScenarioComponent} scenarioComponent
   */
  handleScenarioFail(scenarioComponent) {}
}
module.exports = ScenarioComponent;
