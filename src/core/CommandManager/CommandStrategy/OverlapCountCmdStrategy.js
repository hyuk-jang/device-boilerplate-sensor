const _ = require('lodash');

const {
  dcmConfigModel: {
    commandStep: cmdStep,
    reqWrapCmdType: reqWCT,
    reqDeviceControlType: reqDCT,
  },
} = require('../../../module').di;

const CmdStrategy = require('./CmdStrategy');

class OverlapCountCmdStrategy extends CmdStrategy {
  /**
   * 명령 이벤트가 발생되었을 경우
   * @param {CmdStorage} cmdStorage
   */
  updateCommandStep(cmdStorage) {
    // 명령 Step 최종 단계인 END 일 경우만
    if (cmdStorage.cmdStep === cmdStep.END) {
      // WCT은 둘 중에 하나(CONTROL or CANCEL)
      // 달성 목표(Goal)를 이루었기 때문에 관련된 해당 명령을 복원하는 작업 진행 요청
      if (cmdStorage.wrapCmdType === reqWCT.CONTROL) {
        // 명령 복원이 진행되면 각 명령 Step이 진행됨에 따라 updateCommandStep이 호출되므로 return 처리
        return this.cancelCommand(cmdStorage);
      }
      // 위에서 명령 복원을 완료하였을 경우 실제적으로 명령 저장소에서 삭제
      if (cmdStorage.wrapCmdType === reqWCT.CANCEL) {
        this.cmdManager.removeCommandStorage(cmdStorage);
      }
    }

    return this.cmdManager.notifyUpdateCommandStep(cmdStorage);
  }

  /**
   *
   * @param {reqCommandInfo} reqCmdInfo 기존에 존재하는 명령
   */
  cancelCommand(reqCmdInfo) {
    const { wrapCmdFormat, wrapCmdId } = reqCmdInfo;
    // 복원해야할 명령이 있는지 계산
    const foundCmdStoarge = this.cmdManager.getCmdStorage({
      wrapCmdId,
    });

    // 명령이 존재하지 않을 경우 Throw
    if (_.isEmpty(foundCmdStoarge)) {
      // BU.CLI('뭐햐');
      throw new Error(`${wrapCmdFormat} >>> ${wrapCmdId} does not exist.`);
    }

    // 명령 저장소에서 설정 객체를 불러옴
    const {
      wrapCmdInfo: { containerCmdList },
    } = foundCmdStoarge;

    /** @type {commandContainerInfo[]} Restore Command 생성 */
    const restoreContainerList = _.chain(containerCmdList)
      // 실제 True 하는 장치 필터링
      .filter({ singleControlType: reqDCT.TRUE })
      // True 처리하는 개체가 유일한 개체 목록 추출
      .filter(containerInfo => {
        const { nodeId, singleControlType } = containerInfo;

        // 저장소에 존재하는 cmdElements 중에서 해당 nodeId와 제어 값이 동일한 개체 목록 추출
        const existStorageList = this.cmdManager.getCmdEleList({
          nodeId,
          singleControlType,
          isLive: true,
        });
        return existStorageList.length <= 1;
      })
      // True가 해제되면 False로 자동 복원 명령 생성
      .map(containerInfo => {
        const { nodeId } = containerInfo;
        /** @type {commandContainerInfo} */
        const newContainerInfo = {
          nodeId,
          singleControlType: reqDCT.FALSE,
        };
        return newContainerInfo;
      })
      // 취소는 역순
      .reverse()
      .value();

    // 명령 저장소에 명령 취소 요청
    foundCmdStoarge.cancelCommand(restoreContainerList);

    return foundCmdStoarge;
  }

  /**
   *
   * @param {commandWrapInfo} commandWrapInfo 기존에 존재하는 명령
   */
  isConflict(commandWrapInfo) {
    const { wrapCmdName, containerCmdList } = commandWrapInfo;
    const { TRUE, FALSE } = reqDCT;
    // 제어할려고 하는 Node와 제어 상태를 바꿀려는 명령이 존재하는지 체크
    _.forEach(containerCmdList, cmdContainerInfo => {
      const { nodeId, singleControlType } = cmdContainerInfo;
      const cmdEle = this.cmdManager.getCmdEle({
        nodeId,
        singleControlType: singleControlType === TRUE ? FALSE : TRUE,
      });
      if (cmdEle) {
        throw new Error(
          `${wrapCmdName} 명령은 ${
            cmdEle.wrapCmdName
          } 명령의 ${nodeId} 상태와 충돌합니다.`,
        );
      }
    });
  }

  /**
   * 누적 카운팅에서 공통으로 제어할 명령 로직
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeDefaultControl(reqCmdInfo) {
    const { wrapCmdId, wrapCmdType, srcPlaceId, destPlaceId, reqCmdEleList } = reqCmdInfo;

    // 취소 명령 요청이 들어 올 경우 실행중인 명령 탐색
    if (wrapCmdType === reqWCT.CANCEL) {
      return this.cancelCommand(reqCmdInfo);
    }

    // 이미 실행 중인 명령인지 체크
    const existCmdStorage = this.cmdManager.getCmdStorage({
      wrapCmdId,
    });

    // 이미 존재하는 명령이라면 예외 처리
    if (existCmdStorage) {
      throw new Error(`${existCmdStorage.wrapCmdName} 명령은 존재합니다.`);
    }

    // 실제 수행할 장치를 정제
    const commandWrapInfo = this.cmdManager.refineReqCommand(reqCmdInfo, true);
    this.cmdManager.calcDefaultRealContainerCmd(commandWrapInfo.containerCmdList);

    // 충돌 여부 검증
    this.isConflict(commandWrapInfo);

    return this.cmdManager.executeRealCommand(commandWrapInfo, this);
  }

  /**
   * 단일 제어 명령
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeSingleControl(reqCmdInfo) {
    return this.executeDefaultControl(reqCmdInfo);
  }

  /**
   * 저장된 설정 명령
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeSetControl(reqCmdInfo) {
    return this.executeDefaultControl(reqCmdInfo);
  }

  /**
   * 흐름 명령
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeFlowControl(reqCmdInfo) {
    const { wrapCmdType, srcPlaceId, destPlaceId } = reqCmdInfo;

    if (wrapCmdType === reqWCT.CANCEL) {
      return this.cancelCommand(reqCmdInfo);
    }
    // 흐름 명령 가능 여부 체크 (급배수지 환경 조건 고려[수위, 염도, 온도 등등등])
    this.coreFacade.isPossibleFlowCommand(srcPlaceId, destPlaceId);

    return this.executeDefaultControl(reqCmdInfo);
  }
}
module.exports = OverlapCountCmdStrategy;
