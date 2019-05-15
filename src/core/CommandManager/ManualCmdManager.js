const _ = require('lodash');
const { BU } = require('base-util-jh');

const AbstCmdManager = require('./AbstCmdManager');

const { dcmWsModel, dcmConfigModel } = require('../../../../default-intelligence');

const {
  complexCmdStep,
  nodePickKey,
  complexCmdPickKey,
  controlModeInfo,
  goalDataRange,
  nodeDataType,
  reqWrapCmdType,
  reqDeviceControlType,
} = dcmConfigModel;

class ManualCmdManager extends AbstCmdManager {
  /** @param {MainControl} controller */
  constructor(controller) {
    super(controller);

    // 컨트롤러 제어 모드 변경
    controller.controlMode = controlModeInfo.MANUAL;
  }

  /**
   * @implements
   * 현재 값과 틀리거나 장치 제어 예약이 없는 경우 실제 제어 목록으로 산출
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdContainerInfo[]} realContainerCmdList
   */
  produceRealControlCommand(complexCmdWrapInfo) {
    BU.CLI('produceRealControlCommand');
    const { controlMode, wrapCmdType, containerCmdList } = complexCmdWrapInfo;

    /** @type {complexCmdContainerInfo[]} 실제 명령을 내릴 목록 */
    const realContainerCmdList = [];

    _.forEach(containerCmdList, containerCmdInfo => {
      const { singleControlType, controlSetValue, eleCmdList } = containerCmdInfo;

      // 실제 제어 명령 목록 산출
      const realEleCmdList = _.filter(
        eleCmdList,
        eleCmdInfo =>
          // 존재하지 않을 경우 true
          !this.model.isExistSingleControl({
            nodeId: eleCmdInfo.nodeId,
            singleControlType,
            controlSetValue,
          }),
      );

      // 실제 제어 목록이 존재한다면 삽입
      if (realEleCmdList.length) {
        realContainerCmdList.push({
          singleControlType,
          controlSetValue,
          eleCmdList: realEleCmdList,
        });
      }
    });

    return realContainerCmdList;
  }
}
module.exports = ManualCmdManager;
