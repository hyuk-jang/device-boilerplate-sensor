const _ = require('lodash');
const uuidv4 = require('uuid/v4');

const { BU } = require('base-util-jh');

const CmdStrategy = require('./CmdStrategy');

const CoreFacade = require('../../CoreFacade');

const { dcmConfigModel } = CoreFacade;

const { complexCmdStep, reqWrapCmdType, reqWrapCmdFormat, reqDeviceControlType } = dcmConfigModel;

class OverlapCountCmdStrategy extends CmdStrategy {
  /**
   * @abstract
   * 각 제어 모드 별로 체크하고자 하는 내용 체크
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {boolean} 충돌 true, 아닐 경우 false
   */
  isPossibleSaveComplexCommand(complexCmdWrapInfo) {
    const coreFacade = new CoreFacade();
    try {
      const {
        wrapCmdType,
        wrapCmdFormat,
        srcPlaceId,
        destPlaceId,
        wrapCmdGoalInfo,
      } = complexCmdWrapInfo;

      let isPossible = false;

      // 제어 요청일 경우에 충돌 체크
      if (wrapCmdType === reqWrapCmdType.CONTROL) {
        // 명령 충돌 체크
        isPossible = !this.cmdManager.cmdOverlapManager.isConflictCommand(complexCmdWrapInfo);

        // 흐름 명령을 요청할 경우
        if (wrapCmdFormat === reqWrapCmdFormat.FLOW) {
          isPossible = coreFacade.isPossibleFlowCommand(srcPlaceId, destPlaceId, wrapCmdGoalInfo);
        }
      }

      return isPossible;
    } catch (error) {
      throw error;
    }
  }

  /**
   * @implements
   * O.C 누적 카운팅 상태가 변하거나 현재 장치 값이 틀릴 경우 실제 제어 목록으로 산출
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdContainerInfo[]} realContainerCmdList
   */
  produceRealControlCommand(complexCmdWrapInfo) {
    // BU.CLI('produceRealControlCommand');

    const { wrapCmdType, wrapCmdId, containerCmdList } = complexCmdWrapInfo;

    /** @type {complexCmdContainerInfo[]} 실제 명령을 내릴 목록 */
    let realContainerCmdList = [];

    switch (wrapCmdType) {
      // 제어 요청일 경우 실제 제어 목록 반환
      case reqWrapCmdType.CONTROL:
        realContainerCmdList = this.produceControlCommand(complexCmdWrapInfo);
        break;
      // 취소 요청일 경우 실제 제어 목록 반환
      case reqWrapCmdType.CANCEL:
        realContainerCmdList = this.produceCancelCommand(complexCmdWrapInfo);
        break;

      default:
        break;
    }

    return realContainerCmdList;
  }

  /**
   * 실제 제어하는 장치를 구해 컨테이너 목록 반환
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdContainerInfo[]} realContainerCmdList
   */
  produceControlCommand(complexCmdWrapInfo) {
    // BU.CLI(complexCmdWrapInfo);
    const { containerCmdList } = complexCmdWrapInfo;

    /** @type {complexCmdContainerInfo[]} 실제 명령을 내릴 목록 */
    const realContainerCmdList = [];

    // 명령 컨테이너를 순회
    _.forEach(containerCmdList, containerCmdInfo => {
      const { singleControlType, controlSetValue, eleCmdList } = containerCmdInfo;

      // 각 노드들을 확인
      const realEleCmdList = _.filter(eleCmdList, eleCmdInfo => {
        const { nodeId } = eleCmdInfo;

        // 노드 정보를 불러옴
        const nodeInfo = _.find(this.cmdManager.nodeList, { node_id: nodeId });
        // BU.CLI(nodeInfo);

        // ECU가 존재하는지 체크
        const reservedECU = this.cmdManager.cmdOverlapManager
          .getOverlapStorage(nodeId)
          .getOverlapStatus(singleControlType, controlSetValue)
          .getReservedECU();

        // 이미 제어하는 명령이 존재한다면 추가하지 않음
        if (reservedECU.length) {
          return false;
        }

        // 제어하고자 하는 데이터 값
        const strNodeData = _.lowerCase(
          this.convertControlValueToString(nodeInfo, singleControlType),
        );

        // 제어 변동은 없으나 현 상태 값과 틀리는 장치가 발견될 경우 제어 추가
        if (!_.isNil(nodeInfo.data) && !_.eq(strNodeData, _.lowerCase(nodeInfo.data))) {
          return true;
        }
      });

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
   * 취소할 경우
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdContainerInfo[]} realContainerCmdList
   */
  produceCancelCommand(complexCmdWrapInfo) {
    // BU.CLI('produceCancelCommand');
    try {
      const { wrapCmdId, containerCmdList } = complexCmdWrapInfo;

      // 실행 중인 Wrap Command 를 가져옴
      const runningWrapCmdInfo = _.find(this.cmdManager.complexCmdList, { wrapCmdId });

      // TODO: Wrap Command Step이 RUNNING이 아니라면 DCC 명령 이동, 명령 삭제
      if (runningWrapCmdInfo.wrapCmdStep !== complexCmdStep.RUNNING) {
        this.cancelRunningCommand(runningWrapCmdInfo);
      }

      // 기존 실행 중인 Wrap Command Wrap UUID를 가져옴
      const { wrapCmdUUID: runningWCU } = runningWrapCmdInfo;

      /** @type {complexCmdContainerInfo[]} 실제 명령을 내릴 목록 */
      const realContainerCmdList = [
        {
          singleControlType: reqDeviceControlType.TRUE,
          eleCmdList: [],
        },
        {
          singleControlType: reqDeviceControlType.FALSE,
          eleCmdList: [],
        },
      ];

      // 명령 컨테이너를 순회
      _.forEach(containerCmdList, containerCmdInfo => {
        const { singleControlType, controlSetValue, eleCmdList } = containerCmdInfo;

        // 각 노드들을 확인
        _.forEach(eleCmdList, eleCmdInfo => {
          const { nodeId } = eleCmdInfo;

          // 노드 정보를 불러옴
          const nodeInfo = _.find(this.cmdManager.nodeList, { node_id: nodeId });

          // ECU가 존재하는지 체크
          const overlapWCUs = this.cmdManager.cmdOverlapManager
            .getOverlapStorage(nodeId)
            .getOverlapStatus(singleControlType, controlSetValue)
            .getOverlapWCUs();

          // 현재 장치 상태가 어떤지 확인
          const strNodeData = _.lowerCase(
            this.convertControlValueToString(nodeInfo, singleControlType),
          );

          // 유일한 누적 카운팅이 제거되는 것이라면 장치 상태 변동이 일어 난 것으로 판단
          if (overlapWCUs.length === 1 && _.eq(_.head(overlapWCUs), runningWCU)) {
            // 바꾸고자 하는 장치 값 가져옴
            const expectStrNodeData = _.lowerCase(
              this.convertControlValueToString(nodeInfo, reqDeviceControlType.FALSE),
            );
            // False 상태로 바꿀려는 Node Id 추가
            if (expectStrNodeData !== strNodeData) {
              const realContainerCmd = _.find(realContainerCmdList, {
                singleControlType: reqDeviceControlType.FALSE,
              });
              realContainerCmd.eleCmdList.push(eleCmdInfo);
            }
          }
          // 제어 변동은 있고 현 상태 값과 틀리는 장치가 발견될 경우 제어 추가
          else if (!_.isNil(nodeInfo.data) && !_.eq(strNodeData, _.lowerCase(nodeInfo.data))) {
            const realContainerCmd = _.find(realContainerCmdList, {
              singleControlType,
            });

            realContainerCmd.eleCmdList.push(eleCmdInfo);
          }
        });
      });

      // 실제 False 명령 요청을 할 컨테이너를 찾음
      const realContainerCmd = _.find(realContainerCmdList, {
        singleControlType: reqDeviceControlType.FALSE,
      });

      // 내릴 명령이 존재한다면 명령의 역순으로 요청 처리. (Control 할때는 밸브 > 펌프, Cancel 할때는 펌프 > 밸브 순으로 해야 장치가 안전)
      if (realContainerCmd.eleCmdList.length) {
        realContainerCmd.eleCmdList = _.reverse(realContainerCmd.eleCmdList);
      }

      // 명령 엘리먼트가 있을 경우에만 컨테이너를 포함하여 반환
      return _.filter(realContainerCmdList, realContainer => realContainer.eleCmdList.length);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 실행 중인 명령이 Running Step이 아닐 경우 아직 실행하지 않은 명령들에 대해 취소 처리를 함
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdContainerInfo[]} realContainerCmdList
   */
  cancelRunningCommand(complexCmdWrapInfo) {}

  /**
   * 명령이 완료되었을 경우 처리
   * @param {complexCmdWrapInfo} complexWrapCmdInfo
   * @param {boolean=} isAchieveCommandGoal 명령 목표치 달성 여부
   */
  completeComplexCommand(complexWrapCmdInfo, isAchieveCommandGoal) {
    try {
      // O.C reservedExecUU 제거
      // TODO: Prev.Single >> Curr.Single 명령 제거
      // TODO: Prev.Single >> !Curr.Single 명령 제거
      // TODO: !Prev.Single >> Curr.Single 명령 제거

      const coreFacade = new CoreFacade();

      const { MEASURE, CONTROL, CANCEL } = reqWrapCmdType;

      const { RUNNING } = complexCmdStep;

      let isDeleteCmd = true;

      const { wrapCmdType, wrapCmdUUID, wrapCmdGoalInfo } = complexWrapCmdInfo;

      // 제어 명령일 경우에만 RUNNING 여부 체크
      if (wrapCmdType === CONTROL && coreFacade.getCurrCmdModeName() !== coreFacade.cmdModeName.MANUAL) {
        // 명령 RUNNING 상태 변경
        complexWrapCmdInfo.wrapCmdStep = RUNNING;
        isDeleteCmd = false;

        // TODO: 제어 명령에 달성 목표가 있다면 임계치 관리자 생성
        if (!_.isEmpty(wrapCmdGoalInfo)) {
          // BU.CLI('임계치 명령 생성');
          this.cmdManager.threCmdManager.addThreCmdStorage(complexWrapCmdInfo);
        }
      }

      // 명령 삭제 처리를 해야할 경우
      if (isDeleteCmd) {
        this.cmdManager.cmdOverlapManager.removeOverlapWCU(wrapCmdUUID);
        // Complex Command List 에서 제거
        _.remove(this.cmdManager.complexCmdList, { wrapCmdUUID });
      }

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
module.exports = OverlapCountCmdStrategy;
