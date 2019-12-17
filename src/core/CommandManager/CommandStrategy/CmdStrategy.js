const _ = require('lodash');

const { BU } = require('base-util-jh');

const {
  dcmConfigModel: { reqWrapCmdFormat: reqWCF, reqDeviceControlType: reqDCT },
} = require('../../../../../default-intelligence');

/**
 * 프로젝트 별로 모드가 여러개일 경우 updateControMode를 재구현 하여 Cmd Manager의 cmdStrategist 재정의
 */
class CmdStrategy {
  /** @param {CommandManager} cmdManager */
  constructor(cmdManager) {
    this.cmdManager = cmdManager;

    this.coreFacade = this.cmdManager.coreFacade;
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

  /**
   * 명령 이벤트가 발생되었을 경우
   * @param {CmdStorage} cmdStorage
   */
  updateCommandStep(cmdStorage) {
    BU.CLI('멍미');
  }

  /**
   * 계측 명령
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
  }

  /**
   * 단일 제어 명령
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeSingleControl(reqCmdInfo) {
    const { wrapCmdId } = reqCmdInfo;
    throw new Error(
      `${wrapCmdId} is not available in ${this.cmdManager.getCurrCmdStrategyType()} mode.`,
    );
  }

  /**
   * 저장된 설정 명령
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeSetControl(reqCmdInfo) {
    const { wrapCmdId } = reqCmdInfo;
    throw new Error(
      `${wrapCmdId} is not available in ${this.cmdManager.getCurrCmdStrategyType()} mode.`,
    );
  }

  /**
   * 흐름 명령
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeFlowControl(reqCmdInfo) {
    const { wrapCmdId } = reqCmdInfo;
    throw new Error(
      `${wrapCmdId} is not available in ${this.cmdManager.getCurrCmdStrategyType()} mode.`,
    );
  }

  /**
   * 시나리오 명령
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
      throw new Error(`${nodeInfo.node_id} nc_target_id: ${nodeInfo.nc_target_id} is not defined.`);
    }

    switch (singleControlType) {
      case reqDCT.FALSE:
        strControlValue = strFalse;
        break;
      case reqDCT.TRUE:
        strControlValue = strTrue;
        break;
      case reqDCT.MEASURE:
        strControlValue = 'Measure';
        break;
      case reqDCT.SET:
        strControlValue = 'Set';
        break;
      default:
        break;
    }
    return strControlValue;
  }
}
module.exports = CmdStrategy;
