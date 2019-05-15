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
}
module.exports = AbstCriticalManager;
