const _ = require('lodash');

const { BU } = require('base-util-jh');

const CriticalComponent = require('./CriticalComponent');

const {
  dcmConfigModel: { goalDataRange },
} = require('../../../../default-intelligence');

/**
 * 세부 달성 목표가 있을 경우 생성
 * Node 정보가 갱신되었을 경우 현재의 달성 목표를 비교하고 성공 시 Successor에게 전파
 */
class CriticalGoal extends CriticalComponent {
  /**
   * @param {csCmdGoalInfo} csCmdGoalInfo
   */
  constructor(csCmdGoalInfo) {
    super();
    const { nodeId, goalValue, goalRange, isCompleteClear = false } = csCmdGoalInfo;
    // 임계치 모니터링 Node 객체 Id
    this.nodeId = nodeId;
    // 달성 목표 데이터
    this.goalValue = goalValue;
    // 달성 목표 범위(LOWER, EQUAL, UPPER)
    this.goalRange = goalRange;
    // 이 달성 목표만 성공하면 모든 조건 클리어 여부
    this.isCompleteClear = isCompleteClear;
    // 달성 목표 성공 여부
    this.isClear = false;
  }

  /** @param {CriticalComponent} criticalComponent */

  /**
   * Goal을 성공하였을 경우 알릴 Successor
   * @param {CriticalComponent} criticalComponent
   */
  setSuccessor(criticalComponent) {
    // Critical Storage
    this.successor = criticalComponent;
  }

  /**
   * Critical Manager에서 업데이트된 Node 정보를 전달해옴.
   * 데이터가 달성 목표에 도달하였다면 Critical Stroage에 알림.
   * @param {nodeInfo} nodeInfo
   */
  notifyNodeInfo(nodeInfo) {
    // BU.CLIN(nodeInfo);
    const { data } = nodeInfo;

    let isClear = false;

    if (_.isNumber(data)) {
      isClear = this.updateNumValue(data);
    } else if (_.isString(data)) {
      isClear = this.updateStrValue(data);
    }

    // 성공하지 못한 상태에서 성공 상태로 넘어갔을 경우에만 전파
    if (isClear === true && this.isClear === false) {
      this.isClear = isClear;

      this.successor.notifyClear(this);
    }
  }

  /**
   * @param {number} deviceData number 형식 데이터
   */
  updateNumValue(deviceData) {
    // BU.CLI(deviceData, this.goalRange);
    let isClear = false;

    switch (this.goalRange) {
      case goalDataRange.EQUAL:
        isClear = deviceData === this.goalValue;
        break;
      case goalDataRange.LOWER:
        isClear = deviceData < this.goalValue;
        break;
      case goalDataRange.UPPER:
        isClear = deviceData > this.goalValue;
        break;
      default:
        break;
    }

    return isClear;
  }

  /**
   * @param {string} deviceData string 형식 데이터
   */
  updateStrValue(deviceData) {
    // 문자 데이터일 경우에는 달성 목표가 EQUAL이어야만 함. 문자 상하 비교 불가
    if (this.goalRange !== goalDataRange.EQUAL) return false;

    // 대소 문자의 차이가 있을 수 있으므로 소문자로 변환 후 비교
    return _.lowerCase(deviceData) === _.lowerCase(this.goalValue);
  }
}

module.exports = CriticalGoal;
