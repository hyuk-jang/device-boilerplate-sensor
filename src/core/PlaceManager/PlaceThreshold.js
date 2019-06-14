const Observer = require('../Updator/Observer');

class PlaceThreshold extends Observer {
  updateControlMode(number) {}

  handleUnknown() {}

  handleError() {}

  handleMaxOver() {}

  handleUpperLimitOver() {}

  handleNormal() {}

  handleLowerLimitUnder() {}

  handleMinUnder() {}
}

module.exports = PlaceThreshold;
