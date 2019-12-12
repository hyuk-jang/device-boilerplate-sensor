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

class ManualCmdStrategy extends CmdStrategy {
  /**
   * 명령 이벤트가 발생되었을 경우
   * @param {CmdStorage} cmdStorage
   */
  updateCommandStep(cmdStorage) {
    // BU.CLI('updateCommandStep >>> ManualCmdStrategy', cmdStorage.cmdStep);

    // 달성 목표(Goal)이 없는 명령은 즉시 명령 저장소에서 삭제
    if (cmdStorage.cmdStep === cmdStep.COMPLETE) {
      this.cmdManager.removeCommandStorage(cmdStorage);
    }

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

    // 명령 단계가 완료 또는 종료 일 경우
    // if (cmdStorage.cmdStep === cmdStep.COMPLETE || cmdStorage.cmdStep === cmdStep.END) {
    //   // BU.CLI('updateCommandStep >>> ManualCmdStrategy', cmdStorage.cmdStep);
    //   this.cmdManager.removeCommandStorage(cmdStorage);
    // }

    return this.cmdManager.notifyUpdateCommandStep(cmdStorage);
  }

  /**
   *
   * @param {reqCommandInfo} reqCmdInfo 기존에 존재하는 명령
   */
  cancelCommand(reqCmdInfo) {
    // BU.CLI('cancelCommand');
    const { wrapCmdId } = reqCmdInfo;
    // 복원해야할 명령이 있는지 계산
    const foundCmdStoarge = this.cmdManager.getCmdStorage({
      wrapCmdId,
    });

    /** @type {commandWrapInfo} */
    let cmdWrapInfo = {};

    // 명령이 존재하지 않을 경우 container 계산
    if (_.isEmpty(foundCmdStoarge)) {
      cmdWrapInfo = this.cmdManager.refineReqCommand(reqCmdInfo);
    } else {
      // BU.CLI('저장소가 존재');
      cmdWrapInfo = foundCmdStoarge.wrapCmdInfo;
    }

    // 명령 저장소에서 설정 객체를 불러옴
    /** @type {commandContainerInfo[]} Restore Command 생성 */
    const restoreContainerList = _.chain(cmdWrapInfo.containerCmdList)
      // 실제 True 하는 장치 필터링
      .filter({ singleControlType: reqDeviceControlType.TRUE })
      // 복원 명령으로 변형
      .map(containerInfo => {
        const { nodeId } = containerInfo;
        /** @type {commandContainerInfo} */
        const newContainerInfo = {
          nodeId,
          singleControlType: reqDeviceControlType.FALSE,
          isIgnore: false,
        };
        return newContainerInfo;
      })
      .value();

    // 명령이 존재하지 않을 경우 신규 생성
    if (_.isEmpty(foundCmdStoarge)) {
      // 복원 명령이 존재할 경우
      if (restoreContainerList.length) {
        cmdWrapInfo.containerCmdList = restoreContainerList;

        return this.cmdManager.executeRealCommand(cmdWrapInfo, this);
      }
    } else {
      // 명령 저장소에 명령 취소 요청
      // BU.CLI(restoreContainerList);
      foundCmdStoarge.cancelCommand(restoreContainerList);
      return foundCmdStoarge;
    }
  }

  /**
   * 누적 카운팅에서 공통으로 제어할 명령 로직
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeDefaultControl(reqCmdInfo) {
    try {
      const { wrapCmdId, wrapCmdType } = reqCmdInfo;

      // 취소 명령 요청이 들어 올 경우
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
      const commandWrapInfo = this.cmdManager.refineReqCommand(reqCmdInfo);
      this.cmdManager.calcDefaultRealContainerCmd(commandWrapInfo.containerCmdList);

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
    // BU.CLI(reqCmdInfo);
    try {
      return this.executeDefaultControl(reqCmdInfo);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 시나리오 명령
   * @param {reqCommandInfo} reqCmdInfo
   */
  executeScenarioControl(reqCmdInfo) {
    try {
      const { wrapCmdType } = reqCmdInfo;

      const coreFacade = new CoreFacade();

      switch (wrapCmdType) {
        case reqWCT.CONTROL:
          coreFacade.scenarioManager.executeScenario(reqCmdInfo);
          break;
        case reqWCT.CANCEL:
          coreFacade.scenarioManager.cancelScenario(reqCmdInfo);
          break;
        default:
          break;
      }
    } catch (error) {
      throw error;
    }
  }
}
module.exports = ManualCmdStrategy;
