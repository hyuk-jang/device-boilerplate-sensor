const _ = require('lodash');

const ScenarioComponent = require('./ScenarioComponent');

const CoreFacade = require('../../CoreFacade');

const {
  dcmConfigModel: { reqWrapCmdFormat: reqWCF },
} = CoreFacade;

class ScenarioCommand extends ScenarioComponent {
  /** @param {mScenariCmdInfo} scenarioCmdInfo */
  super(scenarioCmdInfo) {
    /** @type {mScenariCmdInfo} */
    this.scenarioEleCmd = scenarioCmdInfo;

    /** @type {ScenarioComponent} */
    this.scenarioStorage;

    /** @type {complexCmdWrapInfo} */
    this.wrapCmdInfo;

    /** 시나리오 명령 실행 완료 여부 */
    this.isClear = false;
  }

  /**
   * handleScenarioClear 성공하였을 경우 알릴 Successor
   * @param {ScenarioComponent} scenarioStorage
   */
  setSuccessor(scenarioStorage) {
    this.scenarioStorage = scenarioStorage;
  }

  /**
   * 시나리오 동기 명령인지 여부
   * @return {boolean}
   */
  isSync() {
    return this.scenarioStorage.isSync();
  }

  /** 시나리오 명령 실행 */
  executeScenario() {
    const coreFacade = new CoreFacade();

    // 명령 객체가 존재한다면 실행 중
    if (!_.isNil(this.wrapCmdInfo)) {
      return false;
    }

    let executeCmd;

    switch (this.scenarioEleCmd.wrapCmdFormat) {
      // 단일 제어 명령
      case reqWCF.SINGLE:
        executeCmd = coreFacade.executeSingleControl;
        break;
      case reqWCF.SET:
        executeCmd = coreFacade.executeSetControl;
        break;
      case reqWCF.FLOW:
        executeCmd = coreFacade.executeFlowControl;
        break;
      default:
        break;
    }
    // 명령 객체가 존재한다면 명령 실행 요청
    if (executeCmd) {
      this.wrapCmdInfo = executeCmd.call(coreFacade, this.scenarioEleCmd);
      // _.set(this.wrapCmdInfo, 'scenarioObserver', this)
    }
  }

  /** 현재 시나리오 명령 완료 여부 */
  isScenarioClear() {
    return this.isClear;
  }

  /** 단위 명령 요소가 완료되었을 경우 */
  handleScenarioClear() {
    this.isClear = true;
    return this.scenarioStorage.handleScenarioClear();
  }
}
module.exports = ScenarioCommand;
