const CoreAlgorithm = require('../../../../core/CoreAlgorithm');

class AbstAlgorithm extends CoreAlgorithm {
  /** 제어 모드 */
  static get controlModeInfo() {
    return {
      MANUAL: 'MANUAL',
      POWER_OPTIMIZATION: 'POWER_OPTIMIZATION',
      SALTERN_POWER_OPTIMIZATION: 'SALTERN_POWER_OPTIMIZATION',
      RAIN: 'RAIN',
    };
  }

  /** handleUpdateNode Node Definition Id 정보 */
  static get nodeDefIdInfo() {
    return {
      WATER_LEVEL: 'waterLevel',
      SALINITY: 'salinity',
      MODULE_REAR_TEMPERATURE: 'moduleRearTemperature',
    };
  }

  getCurrControlModeName() {}

  setManualMode() {}

  setPowerOptimizationMode() {}

  setSalternOptimizationMode() {}

  setRainMode() {}
}
module.exports = AbstAlgorithm;
