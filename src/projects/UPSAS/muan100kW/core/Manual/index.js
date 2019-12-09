const { BU } = require('base-util-jh');

const WaterLevel = require('./WaterLevel');
const Salinity = require('./Salinity');
const ModuleRearTemp = require('./ModuleRearTemp');

const AlgorithmMode = require('../../../../../core/AlgorithmManager/AlgorithmMode');

const CoreFacade = require('../../../../../core/CoreFacade');

const commonFn = require('../commonFn/commonFn');

class ConcreteAlgorithmMode extends AlgorithmMode {
  /** @param {AbstAlgorithm} controlAlgorithm */
  constructor(controlAlgorithm) {
    super();

    this.operationModeInfo.algorithmId = commonFn.algorithmIdInfo.DEFAULT;
    this.operationModeInfo.algorithmName = '기본';
    this.operationModeInfo.cmdStrategy = new CoreFacade().cmdStrategyType.MANUAL;

    this.threPlaceList.push(new WaterLevel());
    this.threPlaceList.push(new Salinity());
    this.threPlaceList.push(new ModuleRearTemp());
  }
}
module.exports = ConcreteAlgorithmMode;
