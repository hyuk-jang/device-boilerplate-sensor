class ScenarioComponent {
  /**
   * handleScenarioClear 성공하였을 경우 알릴 Successor
   * @param {ScenarioComponent} scenarioComponent
   */
  setSuccessor(scenarioComponent) {}

  isSync() {}

  /** @param {ScenarioComponent} scenarioComponent */
  addScenario(scenarioComponent) {}

  /** @param {ScenarioComponent} scenarioComponent */
  removeScenario(scenarioComponent) {}

  /** 현재 시나리오 명령 완료 여부 */
  isScenarioClear() {}

  /** 시나리오 명령 실행 */
  executeScenario() {}

  /** @param {ScenarioComponent} scenarioComponent */
  handleScenarioClear(scenarioComponent) {}
}
module.exports = ScenarioComponent;