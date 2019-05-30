const _ = require('lodash');

const { BU } = require('base-util-jh');

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
    this.overlapWrapCmdUuidList = [];
    this.reservedEleCmdUuid = '';
  }

  /**
   * @desc CmdOverlapStatus
   * 장치 제어 타입 반환
   * @return {number} singleControType 0(False), 1(True), 2(Measure), 3(Set)
   */
  getSingleControlType() {
    return this.singleControlType;
  }

  /**
   * @desc CmdOverlapStatus
   * 장치 설정 값 반환
   * @return {*} singleControType이 3(Set) 일 경우 설정 값
   */
  getControlSetValue() {
    return this.controlSetValue;
  }

  /**
   * @desc CmdOverlapStatus
   * 명령 누적 Wrap Command UUID 목록 반환
   * @return {string[]}
   */
  getOverlapWCUs() {
    return this.overlapWrapCmdUuidList;
  }

  /**
   * @desc CmdOverlapStatus
   * 장치 제어 예약 명령 단위 UUID
   * @return {string}
   */
  getReservedECU() {
    return this.reservedEleCmdUuid;
  }

  /**
   * @desc CmdOverlapStatus
   * 명령 누적 관리 객체에 새로운 명령의 Wrap Command UUID를 추가
   * @param {string} wrapCmdUuid complexCmdWrapInfo UUID. 유일 키로 명령 요청 시 동적으로 생성 및 부여
   * @return {boolean} WCU 삽입 성공 true, 실패 false
   */
  addOverlapWCU(wrapCmdUuid) {
    // 동일한 WCU가 존재한다면 fasle
    if (_.includes(this.overlapWrapCmdUuidList, wrapCmdUuid)) return false;

    // WCU 삽입 후 true 반환
    return this.overlapWrapCmdUuidList.push(wrapCmdUuid) && true;
  }

  /**
   * @desc CmdOverlapStatus
   * 명령 누적 관리 객체에 존재하는 Wrap Command UUID를 제거
   * @param {string} wrapCmdUuid complexCmdWrapInfo UUID. 유일 키로 명령 요청 시 동적으로 생성 및 부여
   * @return {boolean} WCU 삭제 성공 true, 실패 false
   */
  removeOverlapWCU(wrapCmdUuid) {
    // BU.CLIS(this.overlapWrapCmdUuidList, wrapCmdUuid);
    // 동일한 WCU가 존재한다면 fasle
    if (_.includes(this.overlapWrapCmdUuidList, wrapCmdUuid)) {
      _.pull(this.overlapWrapCmdUuidList, wrapCmdUuid);
      return true;
    }
    // WCU 삽입 후 true 반환
    return false;
  }

  /**
   * @desc CmdOverlapStatus
   * 실제 제어하기 위하여 DCC에 제어 요청 대기 중인 단위 명령의 UUID
   * @param {string} complexCmdEleUuid
   * @return {boolean} ECU 교체 성공 true, 실패 false
   */
  setReservedECU(complexCmdEleUuid) {
    // 기존 명령이 존재하더라도 덮어씌우기 가능으로 설정
    // 기존 명령과 동일할 경우 false
    if (this.reservedEleCmdUuid === complexCmdEleUuid) return false;
    // 명령 설정 후 true 반환
    this.reservedEleCmdUuid = complexCmdEleUuid;
    return true;
  }

  /**
   * @desc CmdOverlapStatus
   * 실제 제어하기 위하여 DCC에 제어 요청인 명령이 완료되었을 경우, 취소되어 DCC 대기열에서 사라질 경우 제거
   * @return {boolean} ECU 리셋 성공 true, 실패 false
   */
  resetReservedECU() {
    // CLU가 존재하지 않는다면 false
    if (this.reservedEleCmdUuid === '') return false;
    // 명령 설정 후 true 반환
    this.reservedEleCmdUuid = '';
    return true;
  }
}
module.exports = CmdOverlapStatus;
