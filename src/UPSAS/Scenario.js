const _ = require('lodash');

const { BU } = require('base-util-jh');
const Promise = require('bluebird');
const ControlDBS = require('../Control');

const { requestOrderCommandType } = require('../../../default-intelligence').dcmConfigModel;

/**
 * 수중태양광 용으로 만들어진 시나리오 모드.
 * 본래 Boilerplate와는 거리가 있음.
 */
class Scenario {
  /** @param {ControlDBS} controller */
  constructor(controller) {
    this.controller = controller;
    this.hasOperationScenario1 = false;

    this.map = this.controller.model.deviceMap;

    /** 시나리오 모드 1 */
    this.controlList = this.map.controlInfo.tempControlList;

    this.eventHandler();
  }

  /** controller에서 eventEmitter 처리 */
  eventHandler() {
    /** controller 에서 인증 된 경우 발생할 handler */
    this.controller.on('interpretScenario', scenarioInfo => {
      BU.CLI('interpretScenario');
      this.interpretScenario(scenarioInfo);
    });
  }

  /**
   * 시나리오를 수행하고자 할 경우
   * @param {{scenarioId: string, requestCommandType: string}} scenarioInfo 시나리오 ID
   */
  interpretScenario(scenarioInfo) {
    BU.CLI(scenarioInfo);
    const { scenarioId, requestCommandType } = scenarioInfo;
    // 명령 타입 체크. MEASURE 까지 포함되어 있지만... webServer 측에서 보내지 말 것
    if (!_.values(requestOrderCommandType).includes(requestCommandType)) {
      throw new Error(`requestCommandType: ${requestCommandType} does not exist.`);
    }
    BU.CLI(scenarioInfo);
    // 제어 요청일 경우에는 true, 아닐 경우에는 false로 설정
    const hasExecute = requestCommandType === requestOrderCommandType.CONTROL;
    BU.CLI(scenarioInfo);

    switch (scenarioId) {
      case 'scenario1':
        BU.CLI(scenarioInfo);
        this.scenarioMode1(hasExecute);
        break;
      default:
        throw new Error(`scenarioId: ${scenarioId} does not exist.`);
    }
    return true;
  }

  /**
   *
   * @param {boolean} hasRequestExecute 시나리오 모드 실행 / 정지
   */
  async scenarioMode1(hasRequestExecute) {
    BU.CLI('scenarioMode1', hasRequestExecute);
    if (hasRequestExecute === false) {
      this.hasOperationScenario1 = false;
      return false;
    }
    if (this.hasOperationScenario1) {
      return false;
    }

    const DELAY_SCALE = 1;

    this.hasOperationScenario1 = true;
    const scenario1 = _.find(this.controlList, { cmdName: '저수조 → 증발지 1' });
    const scenario2 = _.find(this.controlList, { cmdName: '증발지 1 → 해주 1' });
    const scenario3 = _.find(this.controlList, { cmdName: '해주 1 → 증발지 1' });
    const scenario4 = _.find(this.controlList, { cmdName: '증발지 1 → 해주 2' });
    const scenario5 = _.find(this.controlList, { cmdName: '해주 2 → 증발지 2, 3, 4' });
    const scenario6 = _.find(this.controlList, { cmdName: '증발지 4 → 해주3' });
    const scenario7 = _.find(this.controlList, { cmdName: '해주 3 → 결정지' });
    const scenario8 = _.find(this.controlList, { cmdName: '결정지 → 해주 3' });

    // scenario_1: 저수조 → 증발지 1
    if (!this.hasOperationScenario1) return false;
    this.controller.executeAutomaticControl(scenario1);
    // 10초 딜레이 50 초 동안 급수 진행
    await Promise.delay(1000 * 5 * DELAY_SCALE);
    if (!this.hasOperationScenario1) return false;
    this.controller.cancelAutomaticControl(scenario1);

    // 밸브 닫는 시간 + 염수 증발 시간 할애  10초
    await Promise.delay(1000 * 1 * DELAY_SCALE);
    if (!this.hasOperationScenario1) return false;

    // scenario_2: 증발지 1 → 해주 1
    this.controller.executeAutomaticControl(scenario2);
    // 20 초 동안 염수 이동
    await Promise.delay(1000 * 2 * DELAY_SCALE);
    if (!this.hasOperationScenario1) return false;
    // 수로 수문을 너무 일찍 닫기 때문에 사용하지 않음.
    // this.cancelAutomaticControl(scenario_2);

    // 시나리오 3을 진행하면 자동으로 증발지 1 수문이 닫히므로 명령 내리지 않음
    // this.excuteSingleControl({modelId: 'V_101', hasTrue: 'false'});
    // this.excuteSingleControl({modelId: 'V_102', hasTrue: 'false'});
    // this.excuteSingleControl({modelId: 'V_103', hasTrue: 'false'});
    // this.excuteSingleControl({modelId: 'V_104', hasTrue: 'false'});
    // this.excuteSingleControl({modelId: 'WD_005', hasTrue: 'false'});

    // scenario_3: 해주 1 → 증발지 1
    this.controller.executeAutomaticControl(scenario3);
    // 10초 딜레이 50 초 동안 급수 진행
    await Promise.delay(1000 * 5 * DELAY_SCALE);
    if (!this.hasOperationScenario1) return false;
    this.controller.cancelAutomaticControl(scenario3);

    // 밸브 닫는 시간 + 염수 증발 시간 할애
    await Promise.delay(1000 * 1 * DELAY_SCALE);
    if (!this.hasOperationScenario1) return false;

    // scenario_4: 증발지 1 → 해주 2
    this.controller.executeAutomaticControl(scenario4);
    // 20 초 동안 염수 이동 진행
    await Promise.delay(1000 * 2 * DELAY_SCALE);
    if (!this.hasOperationScenario1) return false;
    // 수로 수문을 너무 일찍 닫기 때문에 사용하지 않음.
    // this.cancelAutomaticControl(scenario_4);
    // 염판 수문 닫기
    this.controller.executeAutomaticControl({
      cmdName: '염판 수문 닫기',
      falseList: ['GV_001', 'GV_002', 'GV_003', 'GV_004', 'WD_005'],
    });
    // this.controller.excuteSingleControl({modelId: 'V_102', hasTrue: false});
    // this.controller.excuteSingleControl({modelId: 'V_103', hasTrue: false});
    // this.controller.excuteSingleControl({modelId: 'V_104', hasTrue: false});
    // this.controller.excuteSingleControl({modelId: 'WD_005', hasTrue: false});

    // scenario_5: 해주 2 → 증발지 2, 3, 4
    this.controller.executeAutomaticControl(scenario5);
    // 40 초 동안 염수 이동 진행
    await Promise.delay(1000 * 4 * DELAY_SCALE);
    if (!this.hasOperationScenario1) return false;
    this.controller.cancelAutomaticControl(scenario5);

    // 염수 증발 시키기 5초
    await Promise.delay(1000 * 5);
    if (!this.hasOperationScenario1) return false;

    // scenario_6: 증발지 4 → 해주3
    this.controller.executeAutomaticControl(scenario6);
    // 20 초 동안 염수 이동 진행
    await Promise.delay(1000 * 2 * DELAY_SCALE);
    if (!this.hasOperationScenario1) return false;
    this.controller.cancelAutomaticControl(scenario6);

    // scenario_7: 해주 3 → 결정지
    this.controller.executeAutomaticControl(scenario7);
    // 40 초 동안 염수 이동 진행
    await Promise.delay(1000 * 4 * DELAY_SCALE);
    if (!this.hasOperationScenario1) return false;
    this.controller.cancelAutomaticControl(scenario7);

    // scenario_8: 결정지 → 해주 3
    this.controller.executeAutomaticControl(scenario8);
    // 30 초 동안 염수 이동 진행
    await Promise.delay(1000 * 3 * DELAY_SCALE);
    if (!this.hasOperationScenario1) return false;
    this.controller.cancelAutomaticControl(scenario8);

    this.hasOperationScenario1 = false;

    return true;
  }
}
module.exports = Scenario;