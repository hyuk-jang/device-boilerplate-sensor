const _ = require('lodash');

const { BU } = require('base-util-jh');

const CmdStrategy = require('./CmdStrategy');

const CoreFacade = require('../../CoreFacade');

const {
  dcmConfigModel: {
    reqDeviceControlType,
    reqWrapCmdType: reqWCT,
    reqWrapCmdFormat: reqWCF,
    commandStep: cmdStep,
  },
} = CoreFacade;

class OverlapCountCmdStrategy extends CmdStrategy {
  /**
   * 명령 이벤트가 발생되었을 경우
   * @param {CmdStorage} cmdStorage
   */
  updateCommandStep(cmdStorage) {
    // BU.CLI(
    //   'updateCommandStep >>> OverlapCountCmdStrategy',
    //   `${cmdStorage.wrapCmdId} ${cmdStorage.cmdStep}`,
    // );
    // 명령 종료 일 경우
    if (cmdStorage.cmdStep === cmdStep.END) {
      // 명령 취소 처리가 되었을 경우 삭제
      if (cmdStorage.wrapCmdType === reqWCT.CANCEL) {
        this.cmdManager.removeCommandStorage(cmdStorage);
        return this.cmdManager.notifyUpdateCommandStep(cmdStorage);
      }

      // 명령 완료가 되었다면 명령 취소 요청
      // BU.CLI('업데이트 없이 CANCEL');
      return this.cancelCommand(cmdStorage);
    }

    return this.cmdManager.notifyUpdateCommandStep(cmdStorage);
  }

  /**
   *
   * @param {reqCommandInfo} reqCmdInfo 기존에 존재하는 명령
   */
  cancelCommand(reqCmdInfo) {
    // BU.CLI('cancelCommand');
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
      .filter({ singleControlType: reqDeviceControlType.TRUE })
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
          singleControlType: reqDeviceControlType.FALSE,
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
    try {
      const { wrapCmdId, containerCmdList } = commandWrapInfo;
      const { TRUE, FALSE } = reqDeviceControlType;
      // 제어할려고 하는 Node와 제어 상태를 바꿀려는 명령이 존재하는지 체크
      _.forEach(containerCmdList, cmdContainerInfo => {
        const { nodeId, singleControlType } = cmdContainerInfo;
        const cmdEle = this.cmdManager.getCmdEle({
          nodeId,
          singleControlType: singleControlType === TRUE ? FALSE : TRUE,
        });
        if (cmdEle) {
          throw new Error(`${wrapCmdId} and ${cmdEle.wrapCmdId} conflicted with ${nodeId}.`);
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 누적 카운팅에서 공통으로 제어할 명령 로직
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeDefaultControl(reqCmdInfo) {
    try {
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
        throw new Error(`wrapCmdId: ${wrapCmdId} is exist.`);
      }

      // 실제 수행할 장치를 정제
      const commandWrapInfo = this.cmdManager.refineReqCommand(reqCmdInfo, true);
      this.cmdManager.calcDefaultRealContainerCmd(commandWrapInfo.containerCmdList);

      // 충돌 여부 검증
      this.isConflict(commandWrapInfo);

      // BU.CLIN(commandWrapInfo)

      return this.cmdManager.executeRealCommand(commandWrapInfo, this);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 단일 제어 명령
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeSingleControl(reqCmdInfo) {
    try {
      return this.executeDefaultControl(reqCmdInfo);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 저장된 설정 명령
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
   * 흐름 명령
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeFlowControl(reqCmdInfo) {
    // BU.CLIN(reqCmdInfo);
    try {
      const coreFacade = new CoreFacade();
      const { wrapCmdType, srcPlaceId, destPlaceId } = reqCmdInfo;

      if (wrapCmdType === reqWCT.CANCEL) {
        return this.cancelCommand(reqCmdInfo);
      }
      // 흐름 명령 가능 여부 체크 (급배수지 환경 조건 고려[수위, 염도, 온도 등등등])
      coreFacade.isPossibleFlowCommand(srcPlaceId, destPlaceId);

      return this.executeDefaultControl(reqCmdInfo);
    } catch (error) {
      throw error;
    }
  }
}
module.exports = OverlapCountCmdStrategy;
