const _ = require('lodash');
const { BU } = require('base-util-jh');

const CmdStrategy = require('./CmdStrategy');

class ManualCmdStrategy extends CmdStrategy {
  /**
   * 단일 명령 전략
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeSingleControl(reqCmdInfo) {
    try {
      const { wrapCmdId, reqCmdEleList } = reqCmdInfo;
      const { searchIdList, singleControlType, controlSetValue } = _.head(reqCmdEleList);

      const nodeId = _.head(searchIdList);

      // 현재 실행하고 있는 명령
      const lastCmdEle = this.cmdManager.getLastCmdEle({
        nodeId,
        singleControlType,
        controlSetValue,
      });

      // 제어할 계획이 존재할 경우 실행하지 않음
      if (lastCmdEle) {
        throw new Error(`The ${wrapCmdId} command is already registered.`);
      }

      const wrapCmdInfo = this.cmdManager.refineReqCommand(reqCmdInfo);

      this.cmdManager.calcDefaultRealContainerCmd(wrapCmdInfo.containerCmdList);

      return this.cmdManager.executeRealCommand(wrapCmdInfo);
    } catch (error) {
      throw error;
    }
  }

  /**
   * @implements
   * 현재 값과 틀리거나 장치 제어 예약이 없는 경우 실제 제어 목록으로 산출
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdContainerInfo[]} realContainerCmdList
   */
  produceRealControlCommand(complexCmdWrapInfo) {
    // BU.CLI('produceRealControlCommand');
    const { wrapCmdType, containerCmdList } = complexCmdWrapInfo;

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
