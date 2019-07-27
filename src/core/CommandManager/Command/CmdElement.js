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

    const { nodeId, isIgnore, singleControlType, controlSetValue } = cmdEleInfo;

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
        this.cmdStorage.updateCommandEvent(cmdStep.PROCEED);
        break;
      case dlcMessage.COMMANDSET_EXECUTION_TERMINATE:
      case dlcMessage.COMMANDSET_DELETE:
        this.cmdEleStep = cmdStep.END;
        this.cmdStorage.handleCommandClear(this);
        break;

      default:
        break;
    }
  }

  /** 명령 실행 */
  executeCommandFromDLC() {
    // BU.CLI(this.getExecuteCmdInfo());
    this.dataLoggerController.requestCommand(this.getExecuteCmdInfo());
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
    return this.cmdEleStep === cmdStep.END;
  }
}
module.exports = CmdElement;
