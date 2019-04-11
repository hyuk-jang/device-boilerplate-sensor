const AbstCriticalManager = require('../../../../features/CriticalState/AbstCriticalManager');
const { AbstCriticalState } = require('../../../../features/CriticalState/AbstCriticalState');

const UpperLimitOverState = class extends AbstCriticalState {};
const NormalState = class extends AbstCriticalState {};

class WaterLevelManager extends AbstCriticalManager {
  initState() {
    super.initState();

    this.upperLimitOverState = new UpperLimitOverState(this.controller);
    this.normalState = new NormalState(this.controller);
  }
}

module.exports = WaterLevelManager;
