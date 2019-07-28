const _ = require('lodash');
const uuidv4 = require('uuid/v4');

const { BU } = require('base-util-jh');

const CmdStrategy = require('./CmdStrategy');

const CoreFacade = require('../../CoreFacade');

const { dcmConfigModel } = CoreFacade;

const { complexCmdStep, reqWrapCmdType, reqWrapCmdFormat, reqDeviceControlType } = dcmConfigModel;

class OverlapCountCmdStrategy extends CmdStrategy {
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
      cmdWrapInfo: { containerCmdList },
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
   *
   * @param {commandContainerInfo[]} cmdContainerList 기존에 존재하는 명령
   */
  isConflict(cmdContainerList) {
    const { TRUE, FALSE } = reqDeviceControlType;
    // 제어할려고 하는 Node와 제어 상태를 바꿀려는 명령이 존재하는지 체크
    return _.some(cmdContainerList, cmdContainerInfo => {
      const { nodeId, singleControlType } = cmdContainerInfo;
      return !!this.cmdManager.getCmdEle({
        nodeId,
        singleControlType: singleControlType === TRUE ? FALSE : TRUE,
      });
    });
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

      // 충돌 여부 검증
      const isConflict = this.isConflict(commandWrapInfo.containerCmdList);

      if (isConflict) {
        throw new Error(`Conflict of WCI(${wrapCmdId})`);
      }

      return this.cmdManager.executeRealCommand(commandWrapInfo);
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
      const { wrapCmdId, wrapCmdType, srcPlaceId, destPlaceId, reqCmdEleList } = reqCmdInfo;
      const { searchIdList, singleControlType, controlSetValue } = _.head(reqCmdEleList);

      // 취소 명령 요청이 들어 올 경우 실행중인 명령 탐색
      if (wrapCmdType === reqWrapCmdType.CANCEL) {
        return this.cancelCommand(reqCmdInfo);
      }

      // 충돌 여부 검증
      const isConflict = this.isConflict(restoreContainerList);

      if (isConflict) {
        throw new Error(`Conflict of WCI(${wrapCmdId})`);
      }

      const flowCmdStorage = this.cmdManager.getCmdStorage({
        srcPlaceId,
        destPlaceId,
      });

      // 명령이 존재하지 않을 경우 Throw
      if (_.isEmpty(flowCmdStorage)) {
        throw new Error(`commandId: ${wrapCmdId} does not exist.`);
      }
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
   *
   * @param {reqCommandInfo} reqCommandInfo
   */
  setCommand(reqCommandInfo) {
    const { wrapCmdType, wrapCmdId, reqCmdEleList } = reqCommandInfo;

    this.isPossibleCommand(reqCommandInfo);
  }

  /**
   * 각 제어 모드 별로 체크하고자 하는 내용 체크
   * @param {reqCommandInfo} reqCommandInfo
   * @return {boolean} 충돌 true, 아닐 경우 false
   */
  isPossibleCommand(reqCommandInfo) {
    const coreFacade = new CoreFacade();
    try {
      const {
        wrapCmdType,
        wrapCmdFormat,
        srcPlaceId,
        destPlaceId,
        wrapCmdGoalInfo,
      } = reqCommandInfo;

      let isPossible = false;

      // 제어 요청일 경우에 충돌 체크
      if (wrapCmdType === reqWrapCmdType.CONTROL) {
        // 명령 충돌 체크
        isPossible = !this.cmdManager.cmdOverlapManager.isConflictCommand(reqCommandInfo);

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

      const currCmdModeName = coreFacade.getCurrCmdStrategyType();

      const { MEASURE, CONTROL, CANCEL } = reqWrapCmdType;

      const { RUNNING } = complexCmdStep;

      let isDeleteCmd = true;

      const { wrapCmdType, wrapCmdUUID, wrapCmdGoalInfo } = complexWrapCmdInfo;

      // 제어 명령일 경우에만 RUNNING 여부 체크
      if (wrapCmdType === CONTROL && currCmdModeName !== coreFacade.cmdStrategyType.MANUAL) {
        // 명령 RUNNING 상태 변경
        complexWrapCmdInfo.wrapCmdStep = RUNNING;
        isDeleteCmd = false;

        // TODO: 제어 명령에 달성 목표가 있다면 임계치 관리자 생성
        if (!_.isEmpty(wrapCmdGoalInfo)) {
          // BU.CLI('임계치 명령 생성');
          // BU.CLIN(complexWrapCmdInfo);
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
