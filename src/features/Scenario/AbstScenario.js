const _ = require('lodash');

const { BU } = require('base-util-jh');

const { requestOrderCommandType } = require('../../../../default-intelligence').dcmConfigModel;

class AbstScenario {
  /** @param {MainControl} controller */
  constructor(controller) {
    this.controller = controller;

    // 시나리오 별 동작 유무
    this.hasOperationScenario1 = false;
    this.hasOperationScenario2 = false;
    this.hasOperationScenario3 = false;
  }

  /**
   * 시나리오를 수행하고자 할 경우
   * @param {{scenarioId: string, requestCommandType: string}} scenarioInfo 시나리오 ID
   */
  executeScenario(scenarioInfo) {
    BU.CLI(scenarioInfo);
    const { scenarioId, requestCommandType } = scenarioInfo;
    // 명령 타입 체크. MEASURE 까지 포함되어 있지만... webServer 측에서 보내지 말 것
    if (!_.values(requestOrderCommandType).includes(requestCommandType)) {
      throw new Error(`requestCommandType: ${requestCommandType} does not exist.`);
    }
    // 제어 요청일 경우에는 true, 아닐 경우에는 false로 설정
    const hasExecute = requestCommandType === requestOrderCommandType.CONTROL;

    switch (scenarioId) {
      case 'scenario1':
        this.scenarioMode1(hasExecute);
        break;
      case 'scenario2':
        this.scenarioMode2(hasExecute);
        break;
      case 'scenario3':
        this.scenarioMode3(hasExecute);
        break;
      default:
        throw new Error(`scenarioId: ${scenarioId} does not exist.`);
    }
    return true;
  }

  /**
   * 시나리오 모드 1
   * @param {boolean} hasRequestExecute 시나리오 모드 실행 / 정지
   */
  scenarioMode1(hasRequestExecute) {}

  /**
   * 시나리오 모드 2
   * @param {boolean} hasRequestExecute 시나리오 모드 실행 / 정지
   */
  scenarioMode2(hasRequestExecute) {}

  /**
   * 시나리오 모드 3
   * @param {boolean} hasRequestExecute 시나리오 모드 실행 / 정지
   */
  scenarioMode3(hasRequestExecute) {}
}
module.exports = AbstScenario;
