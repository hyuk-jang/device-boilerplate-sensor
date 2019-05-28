const CmdOverlapComponent = require('./CmdOverlapComponent');
const CmdOverlapStorage = require('./CmdOverlapStorage');
const CmdOverlapStatus = require('./CmdOverlapStatus');

class CmdOverlapManager extends CmdOverlapComponent {
  /** @param {CommandManager} cmdManager */
  constructor(cmdManager) {
    super();
    this.cmdManager = cmdManager;

    /** @type {CmdOverlapStorage[]} */
    this.cmdOverlapStorageList = cmdManager.nodeList.map(
      nodeInfo => new CmdOverlapStorage(nodeInfo),
    );
  }

  /**
   * Overlap이 존재하는 목록을 불러옴
   * @return {csOverlapControlInfo[]}
   */
  get existOverlapStatus() {}

  /**
   * 해당 노드 정보를 가진 명령 누적 저장소를 호출
   * @param {string|nodeInfo} node Node ID or nodeInfo 객체
   * @return {CmdOverlapStorage}
   */
  getOverlapStorage(node) {}

  /**
   *
   * @param {string|nodeInfo} node Node ID or nodeInfo 객체
   * @param {number} singleControlType Device Protocol Converter에 요청할 명령에 대한 인자값 1: Open, On, ... ::: 0: Close, Off, undefind: Status
   * @param {*=} controlSetValue singleControlType 가 SET(3)일 경우 설정하는 값
   * @return {CmdOverlapStatus}
   */
  getOverlapStatus(node, singleControlType, controlSetValue) {}

  /**
   * 명령 충돌 체크. 수동 모드를 제외하고 체크 처리.
   * @param {complexCmdWrapInfo} complexCmdWrapInfo 복합 명령 객체
   * @return {boolean}
   */
  isConflictCommand(complexCmdWrapInfo) {}
}
module.exports = CmdOverlapManager;
