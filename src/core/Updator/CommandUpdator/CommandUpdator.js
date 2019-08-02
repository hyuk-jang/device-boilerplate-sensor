const _ = require('lodash');

const { BU } = require('base-util-jh');

const Updator = require('../Updator');

class CommandUpdator extends Updator {
  /** @param {cmdStorage} cmdStorage 옵저버들에게 제어 모드 변경 알림 */
  notifyObserver(cmdStorage) {
    this.observers.forEach(ob => {
      ob.updateCommandStep(cmdStorage);
    });
  }
}
module.exports = CommandUpdator;
