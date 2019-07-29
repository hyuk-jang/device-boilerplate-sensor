const _ = require('lodash');

const { BU } = require('base-util-jh');

const {
  dcmConfigModel: { reqDeviceControlType, reqWrapCmdFormat: reqWCF, commandStep: cmdStep },
} = require('../../CoreFacade');

/**
 * 프로젝트 별로 모드가 여러개일 경우 updateControMode를 재구현 하여 Cmd Manager의 cmdStrategist 재정의
 */
class CmdStrategy {
  /** @param {CommandManager} cmdManager */
  constructor(cmdManager) {
    this.cmdManager = cmdManager;
  }

  /** 제어 모드가 변경되었을 경우 선행 작업이 이루어져야 할 내용이 있다면 작성 */
  init() {}

  /**
   *
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeCommand(reqCmdInfo) {
    const { wrapCmdId } = reqCmdInfo;
    try {
      switch (reqCmdInfo.wrapCmdFormat) {
        // case reqWCF.MEASURE:
        //   return this.executeMeasureControl(reqCmdInfo);
        case reqWCF.SINGLE:
          return this.executeSingleControl(reqCmdInfo);
        case reqWCF.SET:
          return this.executeSetControl(reqCmdInfo);
        case reqWCF.FLOW:
          return this.executeFlowControl(reqCmdInfo);
        case reqWCF.SCENARIO:
          return this.executeScenarioControl(reqCmdInfo);
        default:
          throw new Error(
            `${wrapCmdId} is not available in ${this.cmdManager.getCurrCmdStrategyType()} mode.`,
          );
      }
    } catch (error) {
      // BU.error(error.message);
      throw error;
    }
  }

  removeCommand() {}

  /**
   * 명령 이벤트가 발생되었을 경우
   * @param {CmdStorage} cmdStorage
   */
  updateCommandStep(cmdStorage) {
    // BU.CLI(cmdStorage.cmdStep);
    // 명령 단계가 완료 또는 종료 일 경우
    if (cmdStorage.cmdStep === cmdStep.COMPLETE || cmdStorage.cmdStep === cmdStep.END) {
      this.cmdManager.removeCommandStorage(cmdStorage);
    }

    return this.cmdManager.notifyUpdateCommandStep(cmdStorage);
  }

  /**
   * 단일 명령 전략
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeMeasureControl(reqCmdInfo) {
    const { wrapCmdId } = reqCmdInfo;

    const cmdStorage = this.cmdManager.getCmdStorage({
      wrapCmdId,
    });

    if (cmdStorage) {
      throw new Error(`wrapCmdId: ${wrapCmdId} is exist`);
    }

    // 실제 수행할 장치를 정제
    const commandWrapInfo = this.cmdManager.refineReqCommand(reqCmdInfo);

    return this.executeRealCommand(commandWrapInfo);

    throw new Error(
      `${wrapCmdId} is not available in ${this.cmdManager.getCurrCmdStrategyType()} mode.`,
    );
  }

  /**
   * 단일 명령 전략
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeSingleControl(reqCmdInfo) {
    const { wrapCmdId } = reqCmdInfo;
    throw new Error(
      `${wrapCmdId} is not available in ${this.cmdManager.getCurrCmdStrategyType()} mode.`,
    );
  }

  /**
   * 단일 명령 전략
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeSetControl(reqCmdInfo) {
    const { wrapCmdId } = reqCmdInfo;
    throw new Error(
      `${wrapCmdId} is not available in ${this.cmdManager.getCurrCmdStrategyType()} mode.`,
    );
  }

  /**
   * 단일 명령 전략
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeFlowControl(reqCmdInfo) {
    const { wrapCmdId } = reqCmdInfo;
    throw new Error(
      `${wrapCmdId} is not available in ${this.cmdManager.getCurrCmdStrategyType()} mode.`,
    );
  }

  /**
   * 단일 명령 전략
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeScenarioControl(reqCmdInfo) {
    const { wrapCmdId } = reqCmdInfo;
    throw new Error(
      `${wrapCmdId} is not available in ${this.cmdManager.getCurrCmdStrategyType()} mode.`,
    );
  }

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
module.exports = CmdStrategy;
