const _ = require('lodash');

const ScenarioComponent = require('./ScenarioComponent');

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
  super() {
    this.successor;
    // 동기화 저장소 여부
    this.isSync = false;

    /** @type {ScenarioComponent[]} */
    this.children = [];
    // 자식 요소 명령 실행 순서 인덱스
    this.executeIndex = 0;

    /** @type {IterableIterator} */
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
  isSync() {
    return this.isSync;
  }

  /** @param {ScenarioComponent} scenarioComponent */
  addScenario(scenarioComponent) {
    // 이미 존재한다면 false 반환
    if (_.findIndex(this.children, scenarioComponent) !== -1) return false;
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
    // 비동기 일 경우에는 자식 요소 일괄 실행
    if (this.isSync === false) {
      this.children.forEach(child => {
        child.executeScenario();
      });
    } else {
      const nextScenario = this.iterator.next();
      if (nextScenario.done) {
        return this.successor.handleScenarioClear();
      }
      // 실행중인 단위 시나리오 Step Index 증가
      this.executeIndex = nextScenario.value;
      // 다음 시나리오 Step 명령 요청
      this.children[this.executeIndex].executeScenario();
    }
  }

  /** 현재 시나리오 명령 완료 여부 */
  isScenarioClear() {
    // 동기 명령 일 경우 현재 실행 중인 명령 Step만 점검
    if (this.isSync()) {
      return this.children[this.executeIndex].isScenarioClear();
    }
    // 자식 내 모든 시나리오가 처리되었는지 여부 확인
    return _.every(this.children, child => child.isScenarioClear());
  }

  /** 단위 명령 요소가 완료되었을 경우 */
  handleScenarioClear() {
    // 진행 중인 시나리오가 완료되었을 경우
    if (this.isScenarioClear()) {
      // 동기 시나리오 일 경우 다음 시나리오 Step 요청
      if (this.isSync()) {
        return this.executeScenario();
      }
      // 모든 시나리오 요소가 완료되었으므로 상위 시나리오 개체에게 처리 요청
      return this.successor.handleScenarioClear();
    }
  }
}
module.exports = ScenarioStorage;