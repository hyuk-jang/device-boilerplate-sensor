const _ = require('lodash');

const uuidv4 = require('uuid/v4');

const { BU } = require('base-util-jh');

const CmdComponent = require('./CmdComponent');

const CoreFacade = require('../../CoreFacade');

const {
  dcmConfigModel: { commandStep },
  dccFlagModel: { definedCommandSetMessage: dlcMessage },
} = CoreFacade;

class CmdElement extends CmdComponent {
  /**
   *
   * @param {Object} cmdEleInfo
   * @param {string} cmdEleInfo.nodeId Node ID
   * @param {number} cmdEleInfo.singleControlType 제어 정보, TRUE, FALSE, SET, MEASURE
   * @param {number=} cmdEleInfo.controlSetValue SET 일 경우 설정 값
   */
  constructor(cmdEleInfo) {
    super();
    this.cmdEleUuid = uuidv4();
    this.cmdEleInfo = cmdEleInfo;

    this.cmdEleStep = commandStep.WAIT;

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

  /**
   *
   * @param {dlcMessage} commandSetMessage
   */
  updateCommand(commandSetMessage) {
    // .commandStep = commandStep.WAIT;
    switch (commandSetMessage) {
      case dlcMessage.COMMANDSET_EXECUTION_START:
        this.cmdEleStep = commandStep.PROCEED;
        this.cmdStorage.updateCommandEvent(commandStep.PROCEED);
        break;
      case dlcMessage.COMMANDSET_EXECUTION_TERMINATE:
      case dlcMessage.COMMANDSET_DELETE:
        this.cmdEleStep = commandStep.COMPLETE;
        this.hasClear = true;
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
    return this.cmdEleStep === commandStep.COMPLETE;
  }
}
module.exports = CmdElement;
