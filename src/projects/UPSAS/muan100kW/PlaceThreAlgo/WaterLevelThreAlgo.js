const _ = require('lodash');

const { BU, CU } = require('base-util-jh');

const PlaceThreshold = require('../../../../core/PlaceManager/PlaceThreshold');

// const M100kThreAlgoStrategy = require('./M100kThreAlgoStrategy');

class WaterLevelThreAlgo extends PlaceThreshold {
  /**
   *
   * @param {M100kThreAlgoStrategy} threAlgoStrategy
   */
  constructor(threAlgoStrategy) {
    super();
    this.threAlgoStrategy = threAlgoStrategy;
  }

  handleMaxOver() {
    BU.CLI('handleMaxOver');
  }
}
module.exports = WaterLevelThreAlgo;
