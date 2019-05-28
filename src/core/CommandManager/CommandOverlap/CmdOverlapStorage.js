const CmdOverlapComponent = require('./CmdOverlapComponent');

class CmdOverlapStorage extends CmdOverlapComponent {
  /**
   *
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
}
module.exports = CmdOverlapStorage;
