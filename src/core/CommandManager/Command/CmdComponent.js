class CmdComponent {
  /**
   * handleCommandClear 성공하였을 경우 알릴 Successor
   * @param {CmdComponent} cmdComponent
   */
  setSuccessor(cmdComponent) {}

  /** @return {string} 명령 유일 UUID */
  getCmdWrapUuid() {
    return this.cmdWrapUuid;
  }

  /** @return {commandWrapInfo} 명령 요청 객체 정보 */
  getCmdWrapInfo() {
    return this.cmdWrapInfo;
  }

  /** @return {string} 명령 형식, SINGLE, SET, FLOW, SCENARIO */
  getCmdWrapFormat() {
    return this.cmdWrapInfo.cmdWrapFormat;
  }

  /** @return {string} 명령 타입, CONTROL, CANCEL, RESTORE, MEASURE */
  getCmdWrapType() {
    return this.cmdWrapInfo.cmdWrapType;
  }

  /** @return {string} 명령 ID */
  getCmdWrapId() {
    return this.cmdWrapInfo.cmdWrapId;
  }

  /** @return {string} 명령 이름 */
  getCmdWrapName() {
    return this.cmdWrapInfo.cmdWrapName;
  }

  /** @return {number} 명령 실행 우선 순위 */
  getCmdWrapRank() {}

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
