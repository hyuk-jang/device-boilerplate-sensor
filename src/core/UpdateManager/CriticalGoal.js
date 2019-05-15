const _ = require('lodash');

const { BU } = require('base-util-jh');

const CriticalManager = require('./CriticalManager');

const { dcmWsModel, dcmConfigModel } = require('../../../../default-intelligence');

const { goalDataRange } = dcmConfigModel;

/**
 * 명령 달성 목표가 생성될 때 마다 객체를 생성.
 * 데이터가 갱신될 때 마다 해당 달성 목표가 처리 되었는지 확인.
 */
class CriticalGoal {
  // /** @param {csCmdGoalInfo} csCmdGoalInfo */
  // constructor(csCmdGoalInfo) {
  //   const { goalValue, goalRange } = csCmdGoalInfo;

  //   this.goalValue = goalValue;
  //   this.goalRange = goalRange;

  //   this.isClear = false;
  // }

  /**
   *  @param {csCmdGoalInfo} csCmdGoalInfo
   */
  constructor(csCmdGoalInfo) {
    const { nodeId, goalValue, goalRange } = csCmdGoalInfo;

    this.nodeId = nodeId;
    this.goalValue = goalValue;
    this.goalRange = goalRange;

    this.isClear = false;
  }

  /**
   * 세부 Goal을 달성하였을 때 알릴 상위 개체
   * @param {CriticalManager} criticalManager
   */
  setObserver(criticalManager) {
    this.criticalManager = criticalManager;
  }

  /**
   *
   * @param {nodeInfo} nodeInfo
   */
  updateNodeInfo(nodeInfo) {
    const { data } = nodeInfo;

    let isClear = false;

    if (_.isNumber(data)) {
      isClear = this.updateNumValue(data);
    } else if (_.isString(data)) {
      isClear = this.updateStrValue(data);
    }

    if (isClear === true && this.isClear === false) {
      this.isClear = isClear;

      // 매니저에게 나 완료되었다고 알림
      this.criticalManager.notifyClear(this);
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
    let isClear = false;

    // 문자 데이터일 경우에는 달성 목표가 EQUAL이어야만 함. 문자 상하 비교 불가
    if (this.goalRange !== goalDataRange.EQUAL) return isClear;

    if (deviceData === this.goalValue) {
      isClear = true;
    }

    return isClear;
  }
}

module.exports = CriticalGoal;
