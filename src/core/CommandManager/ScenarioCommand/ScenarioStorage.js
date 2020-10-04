const _ = require('lodash');

const { BU } = require('base-util-jh');

const ScenarioComponent = require('./ScenarioComponent');
const ScenarioCommand = require('./ScenarioCommand');

const {
  dcmConfigModel: {
    commandStep: cmdStep,
    reqWrapCmdFormat: reqWCF,
    reqWrapCmdType: reqWCT,
  },
} = require('../../../module').di;

/**
 * 명령 이터레이터
 * @param {number} start
 * @param {ScenarioComponent[]} scenarioList
 * @param {number} step
 */
function* makeScenarioIterator(start = 0, scenarioList, step = 1) {
  let n = 0;
  for (let index = start; index < scenarioList.length; index += step) {
    n += 1;
    yield index;
  }
  return n;
}

class ScenarioStorage extends ScenarioComponent {
  /**
   *
   * @param {mScenarioInfo} scenarioInfo
   * @param {CoreFacade} coreFacade
   */
  constructor(scenarioInfo = {}, coreFacade) {
    super();

    this.coreFacade = coreFacade;

    const { cmdId, cmdName, scenarioCount = 1 } = scenarioInfo;

    this.cmdId = cmdId;
    this.scenarioName = cmdName;

    this.successor;
    // 동기화 저장소 여부
    this.isSync = false;

    // 시나리오 반복 횟수
    this.scenarioCount = scenarioCount;

    /** @type {ScenarioComponent[]} */
    this.children = [];
    // 자식 요소 명령 실행 순서 인덱스
    this.executeIndex = 0;

    /** @type {IterableIterator} */
    this.iterator;

    /**
     * 명령 실행 단계
     * WAIT: 명령이 대기열에 올라가있는 리스트, 아직 장치 제어 요청이 일어나기 전
     * PROCEED: 명령이 진행되었을 경우
     * COMPLETE: 명령 요청 처리가 완료되었을 경우
     * RUNNING: COMPLETE 처리가 되었지만 지켜보고자 할 경우, (Goal 달성 및 실행 중 명령으로 둘 경우 )
     * CANCELING: 종전에 요청한 명령을 DLC에 취소를 요청하는 중
     * RESTORE: CANCELING 완료 후 복원 명령이 있을 경우 해당 명령의 완료를 기다리는 경우
     * END: 명령의 종료할 경우.(Goal 달성 및 삭제)
     */
    this.cmdStep = '';
  }

  /** @return {string} 명령 형식, MEASURE, SINGLE, SET, FLOW, SCENARIO */
  get wrapCmdFormat() {
    return reqWCF.SCENARIO;
  }

  /** @return {string} 명령 타입, CONTROL, CANCEL */
  get wrapCmdType() {
    return reqWCT.CONTROL;
  }

  /** @return {string} 명령 ID */
  get wrapCmdId() {
    return this.cmdId;
  }

  /** @return {string} 명령 이름 */
  get wrapCmdName() {
    return this.scenarioName;
  }

  /**
   * 시나리오를 설정 함
   * @param {mScenariCmdInfo[]|mScenariCmdInfo[][]} scenarioList
   * @param {boolean} isSync 명령 동기화 여부
   */
  initScenario(scenarioList, isSync = true) {
    this.isSync = isSync;

    for (let index = 1; index < this.scenarioCount; index += 1) {
      // 시나리오 명령 객체를 Tree 구조로 생성 후 반환
      scenarioList = scenarioList.concat(scenarioList);
    }

    // BU.CLIN(scenarioList);

    _.forEach(scenarioList, scenario => {
      if (!_.isArray(scenario)) {
        const scenarioCommand = new ScenarioCommand(scenario, this.coreFacade);
        scenarioCommand.setSuccessor(this);
        this.addScenario(scenarioCommand);
      } else {
        const scenarioStorage = new ScenarioStorage({}, this.coreFacade);

        scenarioStorage.setSuccessor(this);
        scenarioStorage.initScenario(scenario, !isSync);

        this.addScenario(scenarioStorage);
      }
    });

    this.iterator = makeScenarioIterator(this.executeIndex, this.children);
  }

  /**
   * handleScenarioClear 성공하였을 경우 알릴 Successor
   * @param {ScenarioComponent} scenarioComponent
   */
  setSuccessor(scenarioComponent) {
    this.successor = scenarioComponent;
  }

  /**
   * 시나리오 동기 명령인지 여부
   * @return {boolean}
   */
  getIsSync() {
    return this.isSync;
  }

  /** @param {ScenarioComponent} scenarioComponent */
  addScenario(scenarioComponent) {
    // 이미 존재하여도 동일 명령 추가 가능
    // if (_.findIndex(this.children, scenarioComponent) !== -1) return false;
    // 삽입 후 true 반환
    return this.children.push(scenarioComponent) && true;
  }

  /** @param {ScenarioComponent} scenarioComponent */
  removeScenario(scenarioComponent) {
    // 해당 인자가 존재할 경우 삭제 후 true 반환
    if (_.findIndex(this.children, scenarioComponent) === -1) {
      _.pull(this.children, scenarioComponent);
      return true;
    }
    return false;
  }

  /** 시나리오 명령 실행 */
  executeScenario() {
    // 동기 일 경우에는 자식 요소 단계 별 실행
    this.cmdStep = cmdStep.PROCEED;
    // 비동기 일 경우에는 자식 요소 일괄 실행
    if (this.isSync === false) {
      this.children.forEach(child => {
        child.executeScenario();
      });
    } else {
      const nextScenario = this.iterator.next();
      if (nextScenario.done) {
        return this.successor.handleScenarioClear(this);
      }
      // 실행중인 단위 시나리오 Step Index 증가
      this.executeIndex = nextScenario.value;
      // 다음 시나리오 Step 명령 요청
      this.children[this.executeIndex].executeScenario();
    }
  }

  /**
   * 실행중인 시나리오를 반환
   */
  getRunningScenario() {
    // BU.CLI(this.executeIndex)
    // 동기 명령 일 경우 현재 실행 중인 명령 Step만 점검
    if (this.isSync) {
      // BU.CLIN(this.children)
      return this.children[this.executeIndex];
    }
    // 비동기 명령일 경우 자식 요소에 모두 전파. 부합되는 명령이 존재할 경우 업데이트 처리하고 반환
    return this.children;
  }

  /**
   * 시나리오가 완료되었다고 판단
   * @param {string} wrapCmdId
   */
  updateScenarioClear(wrapCmdId) {
    // 동기 명령 일 경우 현재 실행 중인 명령 Step만 점검
    if (this.isSync) {
      return this.children[this.executeIndex].updateScenarioClear(wrapCmdId);
    }
    // 비동기 명령일 경우 자식 요소에 모두 전파. 부합되는 명령이 존재할 경우 업데이트 처리하고 반환
    return this.children.some(child => child.updateScenarioClear(wrapCmdId));
  }

  /** 현재 시나리오 명령 완료 여부 */
  isScenarioClear() {
    // 동기 명령 일 경우 현재 실행 중인 명령 Step만 점검
    if (this.isSync) {
      return this.children[this.executeIndex].isScenarioClear();
    }
    // 자식 내 모든 시나리오가 처리되었는지 여부 확인
    return this.children.every(child => child.isScenarioClear());
  }

  /**
   * 단위 명령 요소가 완료되었을 경우
   * @param {ScenarioComponent} scenarioComponent
   */
  handleScenarioClear(scenarioComponent) {
    // 시나리오가 완료된 개체는 제거
    // 진행 중인 시나리오가 완료되었을 경우
    if (this.isScenarioClear()) {
      // 동기 시나리오 일 경우 다음 시나리오 Step 요청
      if (this.isSync) {
        return this.executeScenario();
      }
      // 모든 시나리오 요소가 완료되었으므로 상위 시나리오 개체에게 처리 요청
      return this.successor.handleScenarioClear(scenarioComponent);
    }
  }

  /**
   * 시나리오 명령을 실행하는 과정에서 문제가 생길 경우 전체 더이상 실행하지 않음
   * @param {ScenarioComponent} scenarioComponent
   */
  handleScenarioFail(scenarioComponent) {
    this.children.forEach(child => {
      // 자식 객체와 파라메터가 동일할 경우 이미 처리된 것으로 판단
      if (child !== scenarioComponent) return false;

      if (child instanceof ScenarioStorage) {
        // Scenario Storage
        child.handleScenarioFail();
      } else {
        // ScenarioCommand
        child.cancelScenario();
      }
      // 자식내에서 요소 제거
      this.removeScenario(child);
      // 자식 객체 취소 처리를 완료하였으므로 상위 객체에 처리 요청
      this.successor.handleScenarioFail(this);
    });
  }
}
module.exports = ScenarioStorage;
