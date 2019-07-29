const _ = require('lodash');

const uuidv4 = require('uuid/v4');

const { BU } = require('base-util-jh');

const CmdComponent = require('./CmdComponent');

const CoreFacade = require('../../CoreFacade');

const {
  dcmConfigModel: { commandStep: cmdStep },
  dccFlagModel: { definedCommandSetMessage: dlcMessage },
} = CoreFacade;

class CmdElement extends CmdComponent {
  /**
   *
   * @param {commandContainerInfo} cmdEleInfo
   */
  constructor(cmdEleInfo) {
    super();
    this.cmdEleUuid = uuidv4();
    this.cmdEleInfo = cmdEleInfo;

    const { nodeId, isIgnore = false, singleControlType, controlSetValue } = cmdEleInfo;

    this.nodeId = nodeId;
    this.isIgnore = isIgnore;
    this.singleControlType = singleControlType;
    this.controlSetValue = controlSetValue;

    this.cmdEleStep = cmdStep.WAIT;

    const coreFacade = new CoreFacade();
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

  // /** @return {boolean} 명령 실행 무시 여부 */
  // get isIgnore() {
  //   return this.cmdEleInfo.isIgnore;
  // }

  /**
   *
   * @param {dlcMessage} commandSetMessage
   */
  updateCommand(commandSetMessage) {
    // BU.CLI(commandSetMessage);

    switch (commandSetMessage) {
      case dlcMessage.COMMANDSET_EXECUTION_START:
        this.cmdEleStep = cmdStep.PROCEED;
        this.cmdStorage.updateCommandStep(cmdStep.PROCEED);
        break;
      case dlcMessage.COMMANDSET_EXECUTION_TERMINATE:
      case dlcMessage.COMMANDSET_DELETE:
        this.cmdEleStep = cmdStep.COMPLETE;
        this.cmdStorage.handleCommandClear(this);
        break;

      default:
        break;
    }
  }

  /** 명령 실행 */
  executeCommandFromDLC() {
    this.dataLoggerController.requestCommand(this.getExecuteCmdInfo());
  }

  /** 명령 취소 */
  cancelCommandFromDLC() {
    // BU.CLI(this.getExecuteCmdInfo());
    return this.dataLoggerController.deleteCommandSet(this.cmdEleUuid);
  }

  /**
   * @return {executeCmdInfo} DLC 명령 실행 정보
   */
  getExecuteCmdInfo() {
    const { nodeId, controlSetValue, singleControlType } = this.cmdEleInfo;
    const { wrapCmdType, wrapCmdUuid, wrapCmdId, wrapCmdName, rank } = this.cmdStorage;

    return {
      wrapCmdId,
      wrapCmdType,
      wrapCmdName,
      wrapCmdUUID: wrapCmdUuid,
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

  /** @return {string} 명령 형식, SINGLE, SET, FLOW, SCENARIO */
  get wrapCmdUuid() {
    return this.cmdStorage.wrapCmdUuid;
  }

  /** @return {string} 명령 형식, SINGLE, SET, FLOW, SCENARIO */
  get wrapCmdFormat() {
    return this.cmdStorage.wrapCmdFormat;
  }

  /** @return {string} 명령 타입, CONTROL, CANCEL, RESTORE, MEASURE */
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

  /** @return {string} 명령 진행 상태 WAIT, PROCEED, RUNNING, END, CANCELING */
  get wrapCmdStep() {
    return this.cmdStep;
  }
}
module.exports = CmdElement;
