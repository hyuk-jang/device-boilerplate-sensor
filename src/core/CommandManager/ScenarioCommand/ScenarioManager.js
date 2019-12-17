const _ = require('lodash');

const { BU } = require('base-util-jh');

const ScenarioComponent = require('./ScenarioComponent');
const ScenarioStorage = require('./ScenarioStorage');

class ScenarioManager {
  /**
   *
   * @param {mScenarioInfo[]} scenarioCmdList
   * @param {CoreFacade} coreFacade
   */
  constructor(scenarioCmdList, coreFacade) {
    this.coreFacade = coreFacade;
    this.scenarioCmdList = scenarioCmdList;

    this.isCompleteScenario = true;

    /** @type {ScenarioStorage} */
    this.scenarioStorage;
  }

  /**
   * 시나리오 실행 요청
   * @param {reqCommandInfo} reqCommandInfo
   */
  executeScenario(reqCommandInfo) {
    if (this.scenarioStorage instanceof ScenarioStorage) {
      throw new Error(`${this.scenarioStorage.scenarioId} is ruuning.`);
    }

    this.initScenario(reqCommandInfo);
  }

  /**
   * 시나리오 취소 요청
   * @param {reqCommandInfo} reqCommandInfo 시나리오를 초기 설정하고자 할 경우
   * 실행 중인 시나리오를 취소하고자 할 경우. 시나리오는 1개만 실행 될 수 있으므로 그냥 삭제
   */
  cancelScenario(reqCommandInfo) {
    if (this.scenarioStorage instanceof !ScenarioStorage) {
      throw new Error('scenario is not running.');
    }
    // TODO: 시나리오 취소 로직
  }

  /**
   *
   * @param {reqCommandInfo} reqCommandInfo 시나리오를 초기 설정하고자 할 경우
   */
  initScenario(reqCommandInfo) {
    const { wrapCmdId } = reqCommandInfo;

    const scenarioCmdInfo = _.find(this.scenarioCmdList, { scenarioId: wrapCmdId });

    const { scenarioId, scenarioName, scenarioList } = scenarioCmdInfo;

    // 최초 시나리오 저장소 생성
    const scenarioStorage = new ScenarioStorage(scenarioCmdInfo, this.coreFacade);
    // 이벤트를 최종으로 수신할 Successor 등록
    scenarioStorage.setSuccessor(this);

    this.scenarioStorage = scenarioStorage;

    // 시나리오 구성 요소 각각 생성 후 정의 (Tree 구조)
    scenarioStorage.initScenario(scenarioList);
    // BU.CLIN(scenarioStorage, 4);

    // 명령 실행
    scenarioStorage.executeScenario();
  }

  /**
   * 단위 명령 요소가 완료되었을 경우
   * @param {ScenarioComponent} scenarioComponent
   */
  handleScenarioClear(scenarioComponent) {
    this.scenarioStorage = {};
  }

  /**
   * 시나리오 명령을 실행하는 과정에서 문제가 생길 경우 전체 더이상 실행하지 않음
   * @param {ScenarioComponent} scenarioComponent
   */
  handleScenarioFail(scenarioComponent) {
    this.scenarioStorage = {};
  }
}
module.exports = ScenarioManager;
