class CmdOverlapComponent {
  /**
   * @desc CmdOverlapStorage
   * 해당 노드에 새로운 타입의 누적 명령 관리 객체를 추가하고자 할 경우
   * @param {CmdOverlapComponent} cmdOverlapComponent
   */
  addOverlapStatus(cmdOverlapComponent) {}

  /**
   * @desc CmdOverlapStorage
   * 해당 노드에 존재하는 누적 명령 관리 객체를 제거하고자 할 경우
   * @param {CmdOverlapComponent} cmdOverlapComponent
   */
  removeOverlapStatus(cmdOverlapComponent) {}

  /**
   * @desc CmdOverlapStorage
   * 현재 노드 저장소에 제어 값과 제어 설정값이 동일한 객체 추출
   * @param {string} singleControType 0(False), 1(True), 2(Measure), 3(Set)
   * @param {number|string=} controlSetValue  singleControType이 3(Set) 일 경우 설정 값
   * @return {CmdOverlapComponent}
   */
  getOverlapStatus(singleControType, controlSetValue) {}

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
module.exports = CmdOverlapComponent;
