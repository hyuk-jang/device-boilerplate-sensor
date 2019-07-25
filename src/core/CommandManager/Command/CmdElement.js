const _ = require('lodash');

const uuidv4 = require('uuid/v4');

const { BU } = require('base-util-jh');

const CmdComponent = require('./CmdComponent');

const CoreFacade = require('../../CoreFacade');

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

    this.hasClear = false;

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

  /** 명령 실행 */
  executeCommandFromDLC() {
    this.dataLoggerController.requestCommand(this.getExecuteCmdInfo());
  }

  /**
   * @return {executeCmdInfo} DLC 명령 실행 정보
   */
  getExecuteCmdInfo() {
    const { nodeId, controlSetValue, singleControlType } = this.cmdEleInfo;
    return {
      wrapCmdId: this.cmdStorage.getCmdWrapId(),
      wrapCmdType: this.cmdStorage.getCmdWrapType(),
      wrapCmdName: this.cmdStorage.getCmdWrapName(),
      wrapCmdUUID: this.cmdStorage.getCmdWrapUuid(),
      rank: this.cmdStorage.getCmdWrapRank(),
      nodeId,
      singleControlType,
      controlSetValue,
      uuid: this.cmdEleUuid,
    };
  }

  /**
   * 명령 요소가 완료되었을 경우
   */
  updateCommandClear() {
    this.hasClear = true;
    return this.handleCommandClear();
  }

  /**
   * 현재 시나리오 명령 완료 여부
   * @return {boolean}
   */
  isCommandClear() {
    return this.hasClear;
  }
}
module.exports = CmdElement;
