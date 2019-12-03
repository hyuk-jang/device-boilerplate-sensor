const { BU } = require('base-util-jh');

const CoreFacade = require('../../CoreFacade');

const Updator = require('../Updator');

// let conMode = '';
class ControlModeUpdator extends Updator {
  /** 제어 모드(알고리즘) 및 명령 전략 반환 */
  get modeInfo() {
    const coreFacade = new CoreFacade();

    return {
      controlModeInfo: coreFacade.currAlgorithmInfo,
      cmdStrategy: coreFacade.getCurrCmdStrategyType(),
    };
  }

  /** 제어모드 반환 */
  getControlMode() {
    const coreFacade = new CoreFacade();

    return coreFacade.coreAlgorithm.getCurrControlMode();
  }

  /** @param {string} controlMode 옵저버들에게 제어 모드 변경 알림 */
  notifyObserver(controlMode) {
    this.observers.forEach(ob => {
      ob.updateControlMode(controlMode);
    });
  }

  /** @param {string} controlMode 제어 모드 변경 */
  updateMode(controlMode) {
    // 동일 모드
    if (this.getControlMode() === controlMode) {
      return false;
    }

    const coreFacade = new CoreFacade();
    // 제어 모드 변경 여부
    const isChangeControlMode = coreFacade.updateControlMode(controlMode);

    // 제어 모드가 변경이 되었다면 알림 처리
    if (isChangeControlMode) {
      this.notifyObserver(controlMode);

      return true;
    }

    BU.CLI(this.modeInfo);

    return false;

    // // 기존 제어모드에서 변경이 있을 경우 알림
    // if (this.controlMode !== controlMode) {
    //   this.controlMode = controlMode;
    //   this.notifyObserver(controlMode);
    // }
  }
}
module.exports = ControlModeUpdator;
