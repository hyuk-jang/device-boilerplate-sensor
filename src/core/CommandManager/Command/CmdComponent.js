const Updator = require('../../Updator/Updator');

class CmdComponent extends Updator {
  /**
   * handleCommandClear 성공하였을 경우 알릴 Successor
   * @param {CmdComponent} cmdComponent
   */
  setSuccessor(cmdComponent) {}

  /** @return {string} 명령 형식, SINGLE, SET, FLOW, SCENARIO */
  get wrapCmdUuid() {
    return undefined;
  }

  /** @return {string} 명령 형식, SINGLE, SET, FLOW, SCENARIO */
  get wrapCmdFormat() {
    return undefined;
  }

  /** @return {string} 명령 타입, CONTROL, CANCEL, RESTORE, MEASURE */
  get wrapCmdType() {
    return undefined;
  }

  /** @return {string} 명령 ID */
  get wrapCmdId() {
    return undefined;
  }

  /** @return {string} 명령 이름 */
  get wrapCmdName() {
    return undefined;
  }

  /** @return {string} 명령 실행 우선 순위 */
  get rank() {
    return undefined;
  }

  /** @return {csCmdGoalContraintInfo} 임계 정보 */
  get wrapCmdGoalInfo() {
    return undefined;
  }

  /** @return {string} 명령 진행 상태 WAIT, PROCEED, RUNNING, END, CANCELING */
  get wrapCmdStep() {
    return undefined;
  }

  /**
   * 옵션에 맞는 명령 Element 개체 1개 반환
   * @param {cmdElementSearch} cmdElementSearch
   * @return {CmdComponent}
   */
  getCmdEle(cmdElementSearch) {}

  /**
   * 옵션에 맞는 명령 Element 개체 목록 반환
   * @param {cmdElementSearch} cmdElementSearch
   * @return {CmdComponent[]}
   */
  getCmdEleList(cmdElementSearch) {}

  /**
   * 시나리오가 완료되었다고 판단
   * @param {string} wrapCmdId
   */
  updateCommandClear(wrapCmdId) {}

  isSync() {}

  /** @param {CmdComponent} cmdComponent */
  addCommand(cmdComponent) {}

  /** @param {CmdComponent} cmdComponent */
  removeCommand(cmdComponent) {}

  /**
   * 현재 시나리오 명령 완료 여부
   * @return {boolean}
   */
  isCommandClear() {}

  /** 명령 실행 */
  executeCommandFromDLC() {}

  /** @param {CmdComponent} cmdComponent */
  handleCommandClear(cmdComponent) {}

  /** @param {CmdComponent} cmdComponent */
  handleThresholdClear(cmdComponent) {}
}
module.exports = CmdComponent;
