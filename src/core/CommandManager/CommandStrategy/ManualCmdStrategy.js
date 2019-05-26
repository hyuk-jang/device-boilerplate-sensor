const _ = require('lodash');
const { BU } = require('base-util-jh');

const CmdStrategy = require('./CmdStrategy');

const { dcmWsModel, dcmConfigModel } = require('../../../../../default-intelligence');

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

class ManualCmdStrategy extends CmdStrategy {
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
          !this.cmdManager.model.isExistSingleControl({
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

  /**
   * 명령이 완료되었을 경우 처리
   * @param {complexCmdWrapInfo} complexWrapCmdInfo
   * @param {boolean=} isAchieveCommandGoal 명령 목표치 달성 여부
   */
  completeComplexCommand(complexWrapCmdInfo) {
    try {
      const { wrapCmdUUID } = complexWrapCmdInfo;

      // 명령 삭제 처리를 해야할 경우
      // wrapCmdUUID를 가진 O.C 제거
      _(this.overlapControlStorageList)
        .map('overlapControlList')
        .flatten()
        .forEach(overlapControlInfo => {
          _.pull(overlapControlInfo.overlapWCUs, wrapCmdUUID);
        });

      // Complex Command List 에서 제거
      _.remove(this.cmdManager.complexCmdList, { wrapCmdUUID });

      this.cmdManager.model.transmitComplexCommandStatus();
    } catch (error) {
      throw error;
    }

    // OC 변경
    // FIXME: wrapCmdGoalInfo가 존재 할 경우 추가 논리
    // RUNNING 전환 시 limitTimeSec가 존재한다면 복구명령 setTimeout 생성
    // RUNNING 전환 시 goalDataList 존재한다면 추적 nodeList에 추가
  }
}
module.exports = ManualCmdStrategy;