const Observer = require('../../Updator/Observer');

/**
 * @interface
 * 명령 달성 목표가 생성될 때 마다 객체를 생성.
 * 데이터가 갱신될 때 마다 해당 달성 목표가 처리 되었는지 확인.
 */
class ThresholdCommand extends Observer {
  /**
   * notifyClear을 성공하였을 경우 알릴 Successor
   * @param {ThresholdCommand} thresholdCommand
   */
  setSuccessor() {}

  /** @param {ThresholdCommand} thresholdCommand */
  addThreCmd(thresholdCommand) {}

  /** @param {ThresholdCommand} thresholdCommand */
  removeThreCmd(thresholdCommand) {}

  getThreCmd() {}

  /**
   * 세부 목표를 완료했다고 알려 올 세부 객체
   * @param {ThresholdCommand} thresholdCommand
   * @return {ThresholdCommand}
   */
  handleThreCmdClear(thresholdCommand) {}
}
module.exports = ThresholdCommand;
