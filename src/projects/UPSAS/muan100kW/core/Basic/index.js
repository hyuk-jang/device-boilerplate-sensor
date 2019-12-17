const { BU } = require('base-util-jh');

const WaterLevel = require('./WaterLevel');
const Salinity = require('./Salinity');
const ModuleRearTemp = require('./ModuleRearTemp');

const AlgorithmMode = require('../../../../../core/AlgorithmManager/AlgorithmMode');

const commonFn = require('../algorithm/commonFn');

class ConcreteAlgorithmMode extends AlgorithmMode {
  /**
   * @override
   * 초기화
   */
  init() {
    this.operationModeInfo.algorithmId = commonFn.algorithmIdInfo.DEFAULT;
    this.operationModeInfo.algorithmName = '기본';
    this.operationModeInfo.cmdStrategy = 'MANUAL';

    const { WATER_LEVEL, SALINITY, MODULE_REAR_TEMPERATURE } = commonFn.nodeDefIdInfo;

    this.threPlaceList.push(new WaterLevel(this.coreFacade, WATER_LEVEL));
    this.threPlaceList.push(new Salinity(this.coreFacade, SALINITY));
    this.threPlaceList.push(new ModuleRearTemp(this.coreFacade, MODULE_REAR_TEMPERATURE));
  }
}
module.exports = ConcreteAlgorithmMode;
