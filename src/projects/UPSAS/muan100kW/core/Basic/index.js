const { BU } = require('base-util-jh');

const WaterLevel = require('./WaterLevel');
const Salinity = require('./Salinity');
const ModuleRearTemp = require('./ModuleRearTemp');

const AlgorithmMode = require('../../../../../core/AlgorithmManager/AlgorithmMode');

const CoreFacade = require('../../../../../core/CoreFacade');

const commonFn = require('../algorithm/commonFn');

class ConcreteAlgorithmMode extends AlgorithmMode {
  constructor() {
    super();

    this.operationModeInfo.algorithmId = commonFn.algorithmIdInfo.DEFAULT;
    this.operationModeInfo.algorithmName = '기본';
    this.operationModeInfo.cmdStrategy = new CoreFacade().cmdStrategyType.MANUAL;

    const { WATER_LEVEL, SALINITY, MODULE_REAR_TEMPERATURE } = commonFn.nodeDefIdInfo;

    this.threPlaceList.push(new WaterLevel(WATER_LEVEL));
    this.threPlaceList.push(new Salinity(SALINITY));
    this.threPlaceList.push(new ModuleRearTemp(MODULE_REAR_TEMPERATURE));
  }
}
module.exports = ConcreteAlgorithmMode;
