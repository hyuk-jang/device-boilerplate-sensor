const _ = require('lodash');

const { BU } = require('base-util-jh');

const CriticalStorage = require('./CriticalStorage');

const {
  dcmConfigModel: { goalDataRange },
} = require('../../../../default-intelligence');

/**
 * 명령 달성 목표가 생성될 때 마다 객체를 생성.
 * 데이터가 갱신될 때 마다 해당 달성 목표가 처리 되었는지 확인.
 */
class CriticalGoal {
  /**
   * @param {CriticalStorage} criticalStorage
   * @param {csCmdGoalInfo} csCmdGoalInfo
   */
  constructor(criticalStorage, csCmdGoalInfo) {
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
    // 조건 클리어 시 전파할 개체
    this.setObserver(criticalStorage);
  }

  /**
   * 세부 Goal을 달성하였을 때 알릴 상위 개체
   * @param {CriticalStorage} criticalStorage
   */
  setObserver(criticalStorage) {
    this.criticalStorage = criticalStorage;
  }

  /**
   *
   * @param {nodeInfo} nodeInfo
   */
  notifyNodeInfo(nodeInfo) {
    const { data } = nodeInfo;

    let isClear = false;

    switch (data) {
      case _.isNumber(data):
        isClear = this.updateNumValue(data);
        break;
      case _.isString(data):
        isClear = this.updateStrValue(data);
        break;
      default:
        break;
    }

    // if (_.isNumber(data)) {
    //   isClear = this.updateNumValue(data);
    // } else if (_.isString(data)) {
    //   isClear = this.updateStrValue(data);
    // }

    // 성공하지 못한 상태에서 성공 상태로 넘어갔을 경우에만 전파
    if (isClear === true && this.isClear === false) {
      this.isClear = isClear;

      // 매니저에게 나 완료되었다고 알림
      this.criticalStorage.notifyClear(this);
    }
  }

  /**
   * @param {number} deviceData number 형식 데이터
   */
  updateNumValue(deviceData) {
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
