const CmdOverlapComponent = require('./CmdOverlapComponent');

class CmdOverlapStatus extends CmdOverlapComponent {
  /**
   *
   * @param {number} singleControlType Device Protocol Converter에 요청할 명령에 대한 인자값 1: Open, On, ... ::: 0: Close, Off, undefind: Status
   * @param {*=} controlSetValue singleControlType 가 SET(3)일 경우 설정하는 값
   */
  constructor(singleControlType, controlSetValue) {
    super();

    this.singleControlType = singleControlType;
    this.controlSetValue = controlSetValue;
    this.overlapWCUs = [];
    this.reservedExecUU = null;
  }

  /**
   * @desc CmdOverlapStatus
   * 명령 누적 관리 객체에 새로운 명령의 Wrap Command UUID를 추가
   * @param {string} wrapCmdUUID complexCmdWrapInfo UUID. 유일 키로 명령 요청 시 동적으로 생성 및 부여
   */
  addOverlapWCU(wrapCmdUUID) {}

  /**
   * @desc CmdOverlapStatus
   * 명령 누적 관리 객체에 존재하는 Wrap Command UUID를 제거
   * @param {string} wrapCmdUUID complexCmdWrapInfo UUID. 유일 키로 명령 요청 시 동적으로 생성 및 부여
   */
  removeOverlapWCU(wrapCmdUUID) {}

  /**
   * @desc CmdOverlapStatus
   * 실제 제어하기 위하여 DCC에 제어 요청 대기 중인 단위 명령의 UUID
   * @param {string} complexCmdEleUUID
   */
  setReservedExecUU(complexCmdEleUUID) {}

  /**
   * @desc CmdOverlapStatus
   * 실제 제어하기 위하여 DCC에 제어 요청인 명령이 완료되었을 경우, 취소되어 DCC 대기열에서 사라질 경우 제거
   * @param {string} complexCmdEleUUID
   */
  resetReservedExecUU(complexCmdEleUUID) {}
}
module.exports = CmdOverlapStatus;
