const _ = require('lodash');
const { BU } = require('base-util-jh');

const CmdStrategy = require('./CmdStrategy');

const CoreFacade = require('../../CoreFacade');

const { dcmConfigModel } = CoreFacade;

const { complexCmdStep, reqWrapCmdType, reqWrapCmdFormat, reqDeviceControlType } = dcmConfigModel;

class ManualCmdStrategy extends CmdStrategy {
  /**
   *
   * @param {reqCommandInfo} reqCmdInfo 기존에 존재하는 명령
   */
  cancelCommand(reqCmdInfo) {
    const { wrapCmdId } = reqCmdInfo;
    // 복원해야할 명령이 있는지 계산
    const foundCmdStoarge = this.cmdManager.getCmdStorage({
      wrapCmdId,
    });

    // 명령이 존재하지 않을 경우 Throw
    if (_.isEmpty(foundCmdStoarge)) {
      throw new Error(`commandId: ${wrapCmdId} does not exist.`);
    }

    // 명령 저장소에서 설정 객체를 불러옴
    const {
      wrapCmdInfo: { containerCmdList },
    } = foundCmdStoarge;

    /** @type {commandContainerInfo[]} Restore Command 생성 */
    const restoreContainerList = _.chain(containerCmdList)
      // 실제 True 하는 장치 필터링
      .filter({ singleControlType: reqDeviceControlType.TRUE })
      // True 처리하는 개체가 유일한 개체 목록 추출
      .filter(containerInfo => {
        const { nodeId, singleControlType } = containerInfo;

        // 저장소에 존재하는 cmdElements 중에서 해당 nodeId와 제어 값이 동일한 개체 목록 추출
        const existStorageList = this.cmdManager.getCmdEleList({ nodeId, singleControlType });
        return existStorageList.length <= 1;
      })
      // True가 해제되면 False로 자동 복원 명령 생성
      .map(containerInfo => {
        const { nodeId } = containerInfo;
        /** @type {commandContainerInfo} */
        const newContainerInfo = {
          nodeId,
          singleControlType: reqDeviceControlType.FALSE,
        };
        return newContainerInfo;
      })
      .value();

    // 명령 저장소에 명령 취소 요청
    foundCmdStoarge.cancelCommand(reqCmdInfo, restoreContainerList);

    return restoreContainerList;
  }

  /**
   * 누적 카운팅에서 공통으로 제어할 명령 로직
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeDefaultControl(reqCmdInfo) {
    try {
      const { wrapCmdId, wrapCmdType, srcPlaceId, destPlaceId, reqCmdEleList } = reqCmdInfo;

      // 취소 명령 요청이 들어 올 경우 실행중인 명령 탐색
      if (wrapCmdType === reqWrapCmdType.CANCEL) {
        return this.cancelCommand(reqCmdInfo);
      }

      // 실제 수행할 장치를 정제
      const commandWrapInfo = this.cmdManager.refineReqCommand(reqCmdInfo);

      return this.cmdManager.executeRealCommand(commandWrapInfo, this);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 단일 명령 전략
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeSetControl(reqCmdInfo) {
    // BU.CLI(reqCmdInfo);
    try {
      return this.executeDefaultControl(reqCmdInfo);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 단일 명령 전략
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeFlowControl(reqCmdInfo) {
    BU.CLI(reqCmdInfo);
    try {
      return this.executeDefaultControl(reqCmdInfo);
    } catch (error) {
      throw error;
    }
  }

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

      return this.cmdManager.executeRealCommand(wrapCmdInfo, this);
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
