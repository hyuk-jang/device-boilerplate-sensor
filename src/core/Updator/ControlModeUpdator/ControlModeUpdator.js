const _ = require('lodash');

const Updator = require('../Updator');

const {
  dcmConfigModel: { controlModeInfo },
} = require('../../../../../default-intelligence');

class ControlModeUpdator extends Updator {
  constructor() {
    super();
    this.children = [];

    /** @type {number} 컨트롤 제어 모드 */
    this.controlMode;
  }

  /** 제어모드 반환 */
  getControlMode() {
    return this.controlMode;
  }

  /** @param {Observer} observer 옵저버 추가 */
  attachObserver(observer) {
    const foundIndex = _.findIndex(this.children, child => _.isEqual(child, observer));
    // 동일 옵저버가 존재하지 않을 경우에 추가
    if (foundIndex === -1) {
      this.children.push(observer);
    }
  }

  /** @param {Observer} observer 옵저버 제거 */
  dettachObserver(observer) {
    // 대상이 존재하는지 확인
    const foundIndex = _.findIndex(this.children, child => _.isEqual(child, observer));
    // 해당 옵저버 제거
    if (foundIndex !== -1) {
      _.pullAt(this.children, [foundIndex]);
    }
  }

  /** @param {number} controlMode 옵저버들에게 제어 모드 변경 알림 */
  notifyObserver(controlMode) {
    this.children.forEach(child => {
      child.updateControlMode(controlMode);
    });
  }

  /** @param {number} controlMode 제어 모드 변경 */
  updateControlMode(controlMode) {
    console.log('controlMode', controlMode, this.controlMode);
    // 기존 제어모드에서 변경이 있을 경우 알림
    if (this.controlMode !== controlMode) {
      this.controlMode = controlMode;
      this.notifyObserver(controlMode);
    }
  }
}
module.exports = ControlModeUpdator;
