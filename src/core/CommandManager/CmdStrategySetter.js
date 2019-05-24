const { BU } = require('base-util-jh');

/** 명령 처리를 위함 */
const ManualCmdStrategy = require('./CommandStrategy/ManualCmdStrategy');
const AutoCmdStrategy = require('./CommandStrategy/AutoCmdStrategy');

const {
  dcmConfigModel: { controlModeInfo },
} = require('../../../../default-intelligence');

/**
 * 프로젝트 별로 모드가 여러개일 경우 updateControMode를 재구현 하여 Cmd Manager의 cmdStrategy 재정의
 */
class CmdStrategySetter {
  /** @param {CommandManager} cmdManager */
  constructor(cmdManager) {
    this.cmdManager = cmdManager;
  }

  /**
   * 제어모드가 변경되었을 경우 값에 따라 Command Manager를 교체
   * @param {number} controlMode 제어모드
   */
  updateControlMode(controlMode) {
    // BU.CLI('updateControlMode', controlMode);
    let CommandStrategy;

    switch (controlMode) {
      // 수동 모드
      case controlModeInfo.MANUAL:
        CommandStrategy = ManualCmdStrategy;
        break;
      // 자동 모드
      case controlModeInfo.AUTOMATIC:
        CommandStrategy = AutoCmdStrategy;
        break;
      // 기본: 수동 모드
      default:
        CommandStrategy = ManualCmdStrategy;
        break;
    }

    // 명령 전략가 재정의
    const cmdStrategy = new CommandStrategy(this.cmdManager);

    // 제어 모드 변경에 따른 명령 전략 교체
    this.cmdManager.setCommandStrategy(cmdStrategy);
  }
}
module.exports = CmdStrategySetter;
