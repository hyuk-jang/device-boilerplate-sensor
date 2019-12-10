const { BU } = require('base-util-jh');

const CoreFacade = require('../../CoreFacade');

const Updator = require('../Updator');

// let conMode = '';
class OperationModeUpdator extends Updator {
  constructor() {
    super();

    /** @type {AlgorithmMode} */
    this.prevOperationMode = {};
  }

  /** 제어 모드(알고리즘) 및 명령 전략 반환 */
  getOperationConfig() {
    const coreFacade = new CoreFacade();

    return coreFacade.getOperationConfig();
  }

  /**
   * 제어모드 반환
   * @return {AlgorithmMode}
   */
  getOperationMode() {
    const coreFacade = new CoreFacade();

    return coreFacade.coreAlgorithm.operationMode;
  }

  /** @param {AlgorithmMode} algorithmMode 옵저버들에게 제어 모드 변경 알림 */
  notifyObserver(algorithmMode) {
    // 동일 모드라면 교체 불가
    if (this.prevOperationMode === algorithmMode) {
      return false;
    }

    const prevMode = this.prevOperationMode;

    this.observers.forEach(ob => {
      ob.updateOperationMode(algorithmMode, prevMode);
    });

    this.prevOperationMode = algorithmMode;
  }
}
module.exports = OperationModeUpdator;
