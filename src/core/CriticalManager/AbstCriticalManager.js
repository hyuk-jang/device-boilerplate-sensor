const _ = require('lodash');

const { BU } = require('base-util-jh');

/**
 * 명령 달성 목표가 생성될 때 마다 객체를 생성.
 * 데이터가 갱신될 때 마다 해당 달성 목표가 처리 되었는지 확인.
 */
class AbstCriticalManager {
  /** @param {MainControl} controller */
  constructor(controller) {
    this.controller = controller;

    const { model, nodeList } = this.controller;
    const { complexCmdList, overlapControlStorageList, mapCmdInfo } = model;

    this.nodeList = nodeList;

    this.model = model;

    this.complexCmdList = complexCmdList;
    this.overlapControlStorageList = overlapControlStorageList;

    this.mapCmdInfo = mapCmdInfo;
  }

  /**
   *
   * @param {complexCmdWrapInfo} complexCmdWrapInfo 생성된 복합 명령
   */
  init(complexCmdWrapInfo) {
    try {
      const {
        wrapCmdId,
        wrapCmdGoalInfo: { limitTimeSec, goalDataList },
      } = complexCmdWrapInfo;

      this.id = wrapCmdId;

      // 타이머가 존재한다면 임계치 타이머 작동

      // 달성 목표가 존재한다면 Critical Command 바인딩
      goalDataList.forEach(goalDataInfo => {
        const { nodeId, goalRange, goalValue } = goalDataInfo;
        this.model.addCriticalObserver(nodeId, this);
      });

      // this.model.addCriticalObserver
    } catch (error) {
      throw error;
    }
  }

  /**
   *
   * @param {nodeInfo} nodeInfo
   */
  updateNodeInfo(nodeInfo) {}
}

module.exports = AbstCriticalManager;
