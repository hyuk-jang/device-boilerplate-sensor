const { BU } = require('base-util-jh');

const Updator = require('../Updator');

let conMode = '';
class ControlModeUpdator extends Updator {
  /** 제어모드 반환 */
  getControlMode() {
    return this.controlMode;
  }

  /** @param {string} controlMode 옵저버들에게 제어 모드 변경 알림 */
  notifyObserver(controlMode) {
    this.observers.forEach(ob => {
      ob.updateControlMode(controlMode);
    });
  }

  /** @param {string} controlMode 제어 모드 변경 */
  updateMode(controlMode) {
    // 기존 제어모드에서 변경이 있을 경우 알림
    if (conMode !== controlMode) {
      conMode = controlMode;
      this.notifyObserver(controlMode);
    }
  }
}
module.exports = ControlModeUpdator;
