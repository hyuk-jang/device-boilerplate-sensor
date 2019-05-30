const _ = require('lodash');

const { BU } = require('base-util-jh');

const CmdOverlapComponent = require('./CmdOverlapComponent');
const CmdOverlapStatus = require('./CmdOverlapStatus');

/**
 * Node 객체마다 존재하는 명령 누적 목록을 관리하는 객체
 */
class CmdOverlapStorage extends CmdOverlapComponent {
  /**
   * @param {nodeInfo} nodeInfo
   */
  constructor(nodeInfo) {
    super();

    this.nodeInfo = nodeInfo;
    /** @type {CmdOverlapComponent[]} */
    this.children = [];
  }

  /**
   * @desc CmdOverlapStorage
   * 해당 노드에 새로운 타입의 누적 명령 관리 객체를 추가하고자 할 경우
   * @param {CmdOverlapComponent} cmdOverlapComponent
   * @return {boolean} 추가 성공 true, 실패 false
   */
  addOverlapStatus(cmdOverlapComponent) {
    // 이미 존재한다면 false 반환
    if (_.findIndex(this.children, cmdOverlapComponent) !== -1) return false;

    // 삽입 후 true 반환
    return this.children.push(cmdOverlapComponent) && true;
  }

  /**
   * @desc CmdOverlapStorage
   * 해당 노드에 존재하는 누적 명령 관리 객체를 제거하고자 할 경우
   * @param {CmdOverlapComponent} cmdOverlapComponent
   * @return {boolean} 삭제 성공 true, 실패 false
   */
  removeOverlapStatus(cmdOverlapComponent) {
    // 해당 인자가 존재할 경우 삭제 후 true 반환
    if (_.findIndex(this.children, cmdOverlapComponent) === -1) {
      _.pull(this.children, cmdOverlapComponent);
      return true;
    }
    return false;
  }

  /**
   * @desc CmdOverlapManager, CmdOverlapStorage, CmdOverlapStatus
   * 명령 누적 관리 객체에 존재하는 Wrap Command UUID를 제거
   * @param {string} wrapCmdUuid complexCmdWrapInfo UUID. 유일 키로 명령 요청 시 동적으로 생성 및 부여
   * @return {boolean} WCU 삭제 성공 true, 실패 false
   */
  removeOverlapWCU(wrapCmdUuid) {
    // 동일한 WCU가 존재한다면 fasle
    this.children.forEach(child => {
      child.removeOverlapWCU(wrapCmdUuid);
    });
  }

  /**
   * @desc CmdOverlapManager, CmdOverlapStorage
   * 현재 노드 저장소에 제어 값과 제어 설정값이 동일한 객체 추출
   * 만약 제어 설정 Status 객체가 존재하지 않을 경우 생성 및 자식으로 추가 후 반환
   * @param {number} singleControType 0(False), 1(True), 2(Measure), 3(Set)
   * @param {number|string=} controlSetValue  singleControType이 3(Set) 일 경우 설정 값
   * @return {CmdOverlapComponent}
   */
  getOverlapStatus(singleControType, controlSetValue) {
    // 해당 제어 객체가 추출
    let overlapStatus = _.find(this.children, child => {
      return (
        _.eq(singleControType, child.getSingleControlType()) &&
        _.eq(controlSetValue, child.getControlSetValue())
      );
    });

    // 해당 객체가 존재하지 않는다면 생성 및 자식 추가 후 overlapStatus 재정의
    if (_.isEmpty(overlapStatus)) {
      overlapStatus = new CmdOverlapStatus(singleControType, controlSetValue);
      this.addOverlapStatus(overlapStatus);
    }
    return overlapStatus;
  }

  /**
   * @desc CmdOverlapManager, CmdOverlapStorage
   * 단위명령을 가진 Status 객체 조회
   * @param {string} reservedECU
   * @return {CmdOverlapComponent[]}
   */
  getOverlapStatusWithECU(reservedECU) {
    return _.filter(this.children, child => {
      return _.eq(child.getReservedECU(), reservedECU);
    });
  }

  /**
   * @desc CmdOverlapStorage
   * 현재 노드 저장소에 제어 값과 제어 설정값이 동일한 객체를 제외한 목록 반환
   * @param {number} singleControType 0(False), 1(True), 2(Measure), 3(Set)
   * @param {number|string=} controlSetValue  singleControType이 3(Set) 일 경우 설정 값
   * @return {CmdOverlapComponent[]}
   */
  getStatusListExceptOption(singleControType, controlSetValue) {
    return _.reject(this.children, child => {
      // 단일 제어 값과 설정 값이 같은 Overlap Status 객체 제외 반환
      return (
        _.eq(singleControType, child.getSingleControlType()) &&
        _.eq(controlSetValue, child.getControlSetValue())
      );
    });
  }

  /**
   * @desc CmdOverlapStorage
   * 제어할려고 하는 값을 제외한 Overlap Status 객체가 명령 누적을 가지고 있는지 확인
   * @param {number} singleConType 0(False), 1(True), 2(Measure), 3(Set)
   * @param {number|string=} conSetValue singleControType이 3(Set) 일 경우 설정 값
   */
  getExistWcuListExceptOption(singleConType, conSetValue) {
    // 해당 제어 구문을 제외한 Overlap Stauts 객체 목록
    const existStatusList = _.chain(this.getStatusListExceptOption(singleConType, conSetValue))
      .map(overlapStatus => {
        return overlapStatus.getOverlapWCUs().length ? overlapStatus : {};
      })
      .filter(result => !_.isEmpty(result))
      .flatten()
      .value();

    // BU.CLI(existStatusList);

    // 객체가 존재한다면 의미있는 객체로 변환 후 반환
    return existStatusList.length
      ? {
          nodeId: this.nodeInfo.node_id,
          overlapStatusList: existStatusList,
        }
      : {};
  }
}
module.exports = CmdOverlapStorage;
