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

    this.operationModeInfo.algorithmId = commonFn.algorithmIdInfo.SALTERN_OPTIMIZATION;
    this.operationModeInfo.algorithmName = '소금생산 최적화';
    this.operationModeInfo.cmdStrategy = new CoreFacade().cmdStrategyType.OVERLAP_COUNT;

    this.threPlaceList.push(new WaterLevel());
    this.threPlaceList.push(new Salinity());
    this.threPlaceList.push(new ModuleRearTemp());
  }
}
module.exports = ConcreteAlgorithmMode;
