const _ = require('lodash');

const { BU } = require('base-util-jh');

const {
  dcmConfigModel: { reqDeviceControlType },
} = require('../../CoreFacade');

/**
 * 프로젝트 별로 모드가 여러개일 경우 updateControMode를 재구현 하여 Cmd Manager의 cmdStrategist 재정의
 */
class CmdStrategist {
  /** @param {CommandManager} cmdManager */
  constructor(cmdManager) {
    this.cmdManager = cmdManager;
  }

  /** 제어 모드가 변경되었을 경우 선행 작업이 이루어져야 할 내용이 있다면 작성 */
  init() {}

  /**
   * @abstract
   * @param {nodeInfo} nodeInfo
   * @param {string} singleControlType
   */
  convertControlValueToString(nodeInfo, singleControlType) {
    // BU.CLIS(nodeInfo, singleControlType);
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
    } else {
      throw new Error(`ncTargetId: ${nodeInfo.nc_target_id} is not defined.`);
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

  /**
   * 명령을 요청할 때 실제 제어할 컨테이너 목록을 산출하여 반환
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdContainerInfo[]} realContainerCmdList
   */
  produceRealControlCommand(complexCmdWrapInfo) {}

  /**
   * 명령이 완료되었을 경우 처리
   * @param {complexCmdWrapInfo} complexWrapCmdInfo
   * @param {boolean=} isAchieveCommandGoal 명령 목표치 달성 여부
   */
  completeComplexCommand(complexWrapCmdInfo) {}

  updateOverlapControlCommand() {}

  /**
   * @abstract
   * 각 제어 모드 별로 체크하고자 하는 내용 체크
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   */
  isPossibleSaveComplexCommand(complexCmdWrapInfo) {
    return true;
  }
}
module.exports = CmdStrategist;
