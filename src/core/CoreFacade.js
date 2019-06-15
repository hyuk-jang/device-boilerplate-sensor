const _ = require('lodash');

const { BU } = require('base-util-jh');

// singleton 패턴 적용을 위한 인스턴스 변수
let instance;

/** @type {nodeInfo[]} */
let coreNodeList;
/** @type {placeInfo[]} */
let corePlaceList;

const PlaceAlgorithm = require('./PlaceManager/PlaceAlgorithm');

/**
 *
 * @param {string} nodeId
 */
function getNodeInfo(nodeId) {
  return _.find(coreNodeList, { node_id: nodeId });
}

class CoreFacade {
  constructor() {
    // 이미 선언한 적이 있다면 반환
    if (instance) {
      return instance;
    }

    // 현재 this를 instance에 지정
    instance = this;

    this.controller;
    this.cmdManager;
    this.cmdExecManager;
    this.placeManager;

    this.placeAlgorithm = new PlaceAlgorithm();
  }

  /**
   * 명령 관리자 정의
   * @param {MainControl} controller
   */
  setControl(controller) {
    this.controller = controller;

    coreNodeList = this.controller.nodeList;
    corePlaceList = this.controller.placeList;
  }

  /**
   * 명령 관리자 정의
   * @param {CommandManager} cmdManager
   */
  setCmdManager(cmdManager) {
    this.cmdManager = cmdManager;
  }

  /**
   * 명령 실행 관리자 정의
   * @param {CommandExecManager} cmdExecManager
   */
  setCmdExecManager(cmdExecManager) {
    this.cmdExecManager = cmdExecManager;
  }

  /**
   * 장소 관리자 정의
   * @param {PlaceManager} placeManager
   */
  setPlaceManager(placeManager) {
    this.placeManager = placeManager;
  }

  /**
   *
   * @param {string|nodeInfo} node
   * @param {Observer} observer
   */
  attachNodeObserver(node, observer) {
    this.controller.nodeUpdatorManager.attachNodeObserver(node, observer);
  }

  /**
   * @param {nodeInfo|string} nodeInfo nodeId or nodeInfo 객체
   * @param {Observer} observer 옵저버 제거
   */
  dettachNodeObserver(node, observer) {
    this.controller.nodeUpdatorManager.dettachNodeObserver(node, observer);
  }

  /**
   * @desc Place Algorithm :::
   * @param {PlaceAlgorithm} placeAlgorithm
   */
  setPlaceAlgorithm(placeAlgorithm) {
    this.placeAlgorithm = placeAlgorithm;
  }

  /**
   * @desc Place Algorithm :::
   * 흐름 명령을 수행할 수 있는지 여부 체크
   * @param {string} srcPlaceId
   * @param {string} destPlaceId
   * @param {csCmdGoalInfo=} goalInfo
   */
  isPossibleFlowCommand(srcPlaceId, destPlaceId, goalInfo) {
    return this.placeAlgorithm.isPossibleFlowCommand(
      this.placeManager,
      srcPlaceId,
      destPlaceId,
      goalInfo,
    );
  }

  /**
   * Place Node가 갱신이 되었을 경우 처리
   * @param {PlaceComponent} placeStorage
   * @param {PlaceComponent} placeNode
   */
  handleUpdateNode(placeStorage, placeNode) {
    this.placeAlgorithm.handleUpdateNode(this, placeStorage, placeNode);
  }
}

module.exports = CoreFacade;
