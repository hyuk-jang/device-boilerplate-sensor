const _ = require('lodash');

// const CommandManager = require('./CommandManager');
/** 명령 처리를 위함 */
const ManualCmdManager = require('./ManualCmdManager');
// const AutoCmdManager = require('./AutoCmdManager');

const {
  dcmConfigModel: { controlModeInfo, reqDeviceControlType },
} = require('../../../../default-intelligence');

/**
 * 프로젝트 별로 모드가 여러개일 경우 updateControMode를 재구현 하여 Cmd Manager의 cmdStrategist 재정의
 */
class CmdStrategist {
  /** @param {CommandManager} */
  constructor(cmdManager) {
    this.cmdManager = cmdManager;
  }

  /**
   * 제어모드가 변경되었을 경우 값에 따라 Command Manager를 교체
   * @param {number} controlMode 제어모드
   */
  updateControlMode(controlMode) {
    Buffer.CLI('updateControlMode', controlMode);
    let CommandStrategist;

    switch (controlMode) {
      // 수동 모드
      case controlModeInfo.MANUAL:
        CommandStrategist = ManualCmdManager;
        break;
      // 자동 모드
      // case controlModeInfo.AUTOMATIC:
      //   CommandStrategist = AutoCmdManager;
      //   break;
      // 기본: 수동 모드
      default:
        CommandStrategist = ManualCmdManager;
        break;
    }

    // 명령 전략가 재정의
    const cmdStrategist = new CommandStrategist(this.cmdManager);
    this.cmdManager.cmdStrategist = cmdStrategist;
  }

  /**
   * @abstract
   * @param {nodeInfo} nodeInfo
   * @param {string} singleControlType
   */
  convertControlValueToString(nodeInfo, singleControlType) {
    singleControlType = Number(singleControlType);
    let strControlValue = '';
    const onOffList = ['pump'];
    const openCloseList = ['valve', 'waterDoor'];

    let strTrue = '';
    let strFalse = '';

    // Node Class ID를 가져옴. 장치 명에 따라 True, False 개체 명명 변경
    if (_.includes(onOffList, nodeInfo.nc_target_id)) {
      strTrue = 'On';
      strFalse = 'Off';
    } else if (_.includes(openCloseList, nodeInfo.nc_target_id)) {
      strTrue = 'Open';
      strFalse = 'Close';
    }

    switch (singleControlType) {
      case reqDeviceControlType.FALSE:
        strControlValue = strFalse;
        break;
      case reqDeviceControlType.TRUE:
        strControlValue = strTrue;
        break;
      case reqDeviceControlType.MEASURE:
        strControlValue = 'Measure';
        break;
      case reqDeviceControlType.SET:
        strControlValue = 'Set';
        break;
      default:
        break;
    }
    return strControlValue;
  }

  produceRealControlCommand() {}

  completeComplexCommand() {
    this.cmdManager.completeComplexCommand();
  }

  updateOverlapControlCommand() {}
}
module.exports = CmdStrategist;
