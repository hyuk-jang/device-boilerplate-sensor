const _ = require('lodash');

const uuidv4 = require('uuid/v4');

const { BU } = require('base-util-jh');

const {
  dcmConfigModel: { commandStep: cmdStep },
  dccFlagModel: { definedCommandSetMessage: dlcMessage },
} = require('../../../module').di;

const CmdComponent = require('./CmdComponent');

class CmdElement extends CmdComponent {
  /**
   *
   * @param {commandContainerInfo} cmdEleInfo
   * @param {CoreFacade} coreFacade
   */
  constructor(cmdEleInfo, coreFacade) {
    super();
    this.cmdEleUuid = uuidv4();
    this.cmdEleInfo = cmdEleInfo;

    const { nodeId, isIgnore = false, singleControlType, controlSetValue } = cmdEleInfo;

    this.nodeId = nodeId;

    /** 현재 명령 개체가 가치 있음 여부 (명령 취소가 활성화 될경우 false 처리) */
    this.isLive = true;
    /** 실제로는 제어나 취소를 하지 않는 옵션. 현재 값과 같거나 다른 명령에서 요청 중일 경우 활성화 */
    this.isIgnore = isIgnore;

    this.singleControlType = singleControlType;
    this.controlSetValue = controlSetValue;

    this.cmdEleStep = cmdStep.WAIT;

    // 데이터 로거 컨트롤러 DLC
    this.dataLoggerController = coreFacade.controller.model.findDataLoggerController(
      cmdEleInfo.nodeId,
    );

    _.once(this.executeCommandFromDLC);
  }

  /**
   * handleCommandClear 성공하였을 경우 알릴 Successor
   * @param {CmdComponent} cmdStorage
   */
  setSuccessor(cmdStorage) {
    this.cmdStorage = cmdStorage;
  }

  /** @return {string} 명령 실행 우선 순위 */
  get rank() {
    return this.cmdStorage.rank;
  }

  /**
   *
   * @param {dlcMessage} commandSetMessage
   */
  updateCommand(commandSetMessage) {
    // BU.CLI(commandSetMessage);
    // if (this.nodeId === 'P_001') {
    // const coreFacade = new CoreFacade();
    // BU.CLI(commandSetMessage, coreFacade.getNodeInfo(this.nodeId).data);
    // }

    switch (commandSetMessage) {
      case dlcMessage.COMMANDSET_EXECUTION_START:
        this.cmdEleStep = cmdStep.PROCEED;
        // 삭제 처리되지 않았을 경우 저장소에 알림
        this.cmdStorage.handleCommandClear(this);
        // this.cmdStorage.updateCommandStep(cmdStep.PROCEED);
        break;
      case dlcMessage.COMMANDSET_EXECUTION_TERMINATE:
      case dlcMessage.COMMANDSET_DELETE:
        this.cmdEleStep = cmdStep.COMPLETE;
        // 삭제 처리되지 않았을 경우 저장소에 알림
        this.cmdStorage.handleCommandClear(this);
        break;

      default:
        break;
    }
  }

  /** 명령 실행 */
  executeCommandFromDLC() {
    // 무시를 하는 경우라면 요청하지 않음
    if (this.isIgnore) {
      return;
    }
    // if (this.nodeId === 'P_001') {
    //   BU.CLI(this.getExecuteCmdInfo());
    // }
    this.dataLoggerController.requestCommand(this.getExecuteCmdInfo());
  }

  /** 명령 취소 */
  cancelCommandFromDLC() {
    if (this.isIgnore) {
      return;
    }
    // BU.CLI('명령 취소', this.getExecuteCmdInfo());
    return this.dataLoggerController.deleteCommandSet({ uuid: this.cmdEleUuid });
  }

  /**
   * @return {executeCmdInfo} DLC 명령 실행 정보
   */
  getExecuteCmdInfo() {
    const { nodeId, controlSetValue, singleControlType } = this.cmdEleInfo;
    const { wrapCmdType, wrapCmdUUID, wrapCmdId, wrapCmdName, rank } = this.cmdStorage;

    return {
      wrapCmdId,
      wrapCmdType,
      wrapCmdName,
      wrapCmdUUID,
      rank,
      nodeId,
      singleControlType,
      controlSetValue,
      uuid: this.cmdEleUuid,
    };
  }

  /**
   * 현재 시나리오 명령 완료 여부
   * @return {boolean}
   */
  isCommandClear() {
    return this.isIgnore || this.cmdEleStep === cmdStep.COMPLETE;
  }

  /** @return {string} 명령 저장소 유일 UUID */
  get wrapCmdUUID() {
    return this.cmdStorage.wrapCmdUUID;
  }

  /** @return {string} 명령 형식, MEASURE, SINGLE, SET, FLOW, SCENARIO */
  get wrapCmdFormat() {
    return this.cmdStorage.wrapCmdFormat;
  }

  /** @return {string} 명령 타입, CONTROL, CANCEL */
  get wrapCmdType() {
    return this.cmdStorage.wrapCmdType;
  }

  /** @return {string} 명령 ID */
  get wrapCmdId() {
    return this.cmdStorage.wrapCmdId;
  }

  /** @return {string} 명령 이름 */
  get wrapCmdName() {
    return this.cmdStorage.wrapCmdName;
  }

  /** @return {string} 명령 실행 우선 순위 */
  get wrapCmdRank() {
    return this.cmdStorage.rank;
  }

  /** @return {csCmdGoalContraintInfo} 임계 정보 */
  get wrapCmdGoalInfo() {
    return this.cmdStorage.wrapCmdGoalInfo;
  }

  /** @return {string} 출발지 장소 Id */
  get srcPlaceId() {
    return this.cmdStorage.srcPlaceId;
  }

  /** @return {string} 목적지 장소 Id */
  get destPlaceId() {
    return this.cmdStorage.destPlaceId;
  }

  /** @return {string} 명령 진행 단계: WAIT, PROCEED, COMPLETE, RUNNING, CANCELING, RESTORE, END */
  get wrapCmdStep() {
    return this.cmdStorage.cmdStep;
  }
}
module.exports = CmdElement;
