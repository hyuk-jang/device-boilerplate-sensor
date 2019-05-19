const _ = require('lodash');

const { BU } = require('base-util-jh');

const CriticalComponent = require('./CriticalComponent');

/**
 * 명령 달성 목표가 생성될 때 마다 객체를 생성.
 * 임계치 관리 저장소. Storage > Goal 순으로 Tree 구조를 가짐
 * 데이터가 갱신될 때 마다 해당 달성 목표가 처리 되었는지 확인.
 * 달성 목표를 완료하였거나 Timer의 동작이 진행되면 Successor에게 전파
 */
class CriticalStorage extends CriticalComponent {
  /**
   *
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   */
  constructor(complexCmdWrapInfo) {
    super();

    /** @type {CriticalComponent[]} */
    this.children = [];

    this.complexCmdWrapInfo = complexCmdWrapInfo;

    const { wrapCmdId } = complexCmdWrapInfo;

    this.id = wrapCmdId;

    this.criticalLimitTimer;
  }

  /**
   * notifyClear을 성공하였을 경우 알릴 Successor
   * @param {CriticalComponent} criticalComponent
   */
  setSuccessor(criticalComponent) {
    // Critical Manager
    this.successor = criticalComponent;
  }

  /**
   * 제한 시간이 존재한다면 SetTimer 등록 및 세부 달성 목표 개체 정의
   * @param {number} limitTimeSec
   */
  startLimiter(limitTimeSec) {
    this.criticalLimitTimer = setTimeout(() => {
      // 제한 시간 초과로 달성 목표를 이루었다고 판단
      this.notifyClear(this);
    }, limitTimeSec * 1000);
  }

  /** @param {CriticalComponent} criticalComponent */
  addComponent(criticalComponent) {
    this.children.push(criticalComponent);
  }

  /** @param {CriticalComponent} criticalComponent */
  removeComponent(criticalComponent) {
    _.remove(this.children, child => _.isEqual(child, criticalComponent));
  }

  /**
   * 세부 달성 목표
   * @param {string} nodeId Node Id
   * @return {CriticalComponent}
   */
  getCriticalComponent(nodeId) {
    return _.find(this.children, { nodeId });
  }

  /**
   * 세부 목표를 완료했다고 알려 올 세부 객체
   * @param {CriticalComponent} criticalGoalLeaf
   */
  notifyClear(criticalGoalLeaf) {
    // BU.CLI('notifyClear');
    let isCompleteClear = false;
    // 유일
    if (criticalGoalLeaf.isCompleteClear) {
      isCompleteClear = true;
    } else {
      isCompleteClear = _.every(this.children, 'isClear');
    }

    // 모든 조건이 충족되었다면 명령 해제
    isCompleteClear && this.successor.notifyClear(this);
  }
}

module.exports = CriticalStorage;
