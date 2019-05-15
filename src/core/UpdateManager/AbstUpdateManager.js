const _ = require('lodash');

const { BU } = require('base-util-jh');

class AbstUpdateManager {
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
module.exports = AbstUpdateManager;
