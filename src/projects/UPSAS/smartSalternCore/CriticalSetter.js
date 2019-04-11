const _ = require('lodash');

const AbstCriticalSetter = require('../../../features/CriticalState/AbstCriticalSetter');

const SalinityManager = require('./smartSalternCritical/SalinityManager');
const WaterLevelManager = require('./smartSalternCritical/WaterLevelManager');

// const CRITICAL_NODE_DEF_ID_INF

class CriticalSetter extends AbstCriticalSetter {
  // /** @param {MainControl} controller */
  // constructor(controller) {
  //   super(controller);
  // }

  /**
   * @override
   * @param {criPlaceInfo} placeInfo
   * @param {mCriticalControlInfo} criticalConInfo
   */
  addCritical(placeInfo, criticalConInfo) {
    !_.has(placeInfo, 'criticalManagerList') && _.set(placeInfo, 'criticalManagerList', []);

    const { ndId } = criticalConInfo;

    let criticalManager;
    switch (ndId) {
      // 수위 임계치
      case 'waterLevel':
        criticalManager = new WaterLevelManager(this.controller, criticalConInfo);
        break;
      case 'salinity':
        criticalManager = new SalinityManager(this.controller, criticalConInfo);
        break;
      default:
        break;
    }

    placeInfo.criticalManagerList.push(criticalManager);
  }
}
module.exports = CriticalSetter;
