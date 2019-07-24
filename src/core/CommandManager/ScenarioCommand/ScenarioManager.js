const _ = require('lodash');

const { BU } = require('base-util-jh');

const ScenarioComponent = require('./ScenarioComponent');
const ScenarioStorage = require('./ScenarioStorage');
// const PlaceNode = require('./PlaceNode');

class ScenarioManager {
  constructor() {
    this.isCompleteScenario = true;

    /** @type {mScenarioInfo} */
    this.scenarioInfo;

    /** @type {ScenarioStorage} */
    this.scenarioManager;
  }

  /**
   *
   * @param {mScenarioInfo} scenarioInfo 시나리오를 초기 설정하고자 할 경우
   */
  initScenario(scenarioInfo) {
    this.isCompleteScenario = false;
    // 시나리오 정보
    this.scenarioInfo = scenarioInfo;
    // 최초 시나리오 저장소 생성
    const scenarioManager = new ScenarioStorage();
    // 시나리오 구성 요소 각각 생성 후 정의 (Tree 구조)
    scenarioManager.initScenario(scenarioInfo.scenarioList);
    // 명령 실행
    scenarioManager.executeScenario();
  }

  /**
   * 시나리오가 완료되었다고 판단
   * @param {string} wrapCmdId
   */
  updateScenarioClear(wrapCmdId) {}

  /** @param {ScenarioComponent} scenarioComponent */
  handleScenarioClear(scenarioComponent) {}
}
module.exports = ScenarioManager;
