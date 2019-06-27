const _ = require('lodash');

const { BU } = require('base-util-jh');

// singleton 패턴 적용을 위한 인스턴스 변수
let instance;

/** @type {nodeInfo[]} */
let coreNodeList;
/** @type {placeInfo[]} */
let corePlaceList;

const { dcmWsModel, dccFlagModel, dcmConfigModel } = require('../../../default-intelligence');

const CoreAlgorithm = require('./CoreAlgorithm');

const PlaceComponent = require('././PlaceManager/PlaceComponent');
const PlaceThreshold = require('././PlaceManager/PlaceThreshold');

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

    this.coreAlgorithm = new CoreAlgorithm();
  }

  static get constructorInfo() {
    return {
      CoreAlgorithm,
      PlaceComponent,
      PlaceThreshold,
    };
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

  /** @param {string} controlMode 제어 모드 변경 알림 */
  updateControlMode(controlMode) {
    this.coreAlgorithm.updateControlMode(controlMode);
  }

  /** 명령 모드 종류 */
  get cmdMode() {
    return this.cmdManager.cmdModeType;
  }

  /** 현재 명령 모드 */
  getCurrCmdMode() {
    return this.cmdManager.getCurrCmdMode();
  }

  /**
   * 명령모드를 변경하고자 할 경우
   * @param {string} cmdMode 자동 명령 모드 여부
   */
  changeCmdStrategy(cmdMode) {
    // BU.debugConsole();
    // BU.CLI('changeCmdStrategy', cmdMode);
    return this.cmdManager.changeCmdStrategy(cmdMode);
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
    this.coreAlgorithm = placeAlgorithm;
  }

  /**
   * @desc Place Algorithm :::
   * 흐름 명령을 수행할 수 있는지 여부 체크
   * @param {string} srcPlaceId
   * @param {string} destPlaceId
   * @param {csCmdGoalInfo=} goalInfo
   */
  isPossibleFlowCommand(srcPlaceId, destPlaceId, goalInfo) {
    return this.coreAlgorithm.isPossibleFlowCommand(
      this.placeManager,
      srcPlaceId,
      destPlaceId,
      goalInfo,
    );
  }

  /**
   * Place Node가 갱신이 되었을 경우 처리
   * @param {PlaceComponent} placeNode
   * @param {boolean=} 예외 발생 시 throw 여부
   */
  handleUpdateNode(placeNode, isIgnoreError = false) {
    try {
      this.coreAlgorithm.handleUpdateNode(this, placeNode);
    } catch (error) {
      // BU.error(error);
      // if (isIgnoreError) return false;
      throw error;
    }
  }

  /**
   * 장소의 임계치 체크를 할 경우.
   * 자동프로세스로 돌아갈 경우 사용. 명령 실패 시 별도의 조치를 취하지 않음
   * @param {string} placeId
   * @param {string} nodeDefId
   */
  reloadPlaceStorage(placeId, nodeDefId) {
    try {
      this.placeManager.getPlaceStorage(placeId).updateNode(nodeDefId);
    } catch (error) {
      BU.error(error.message);
    }
  }

  /**
   * 자동 프로세스에 의한 명령을 내릴 경우 사용.
   * 예외 발생 시 무시
   * @param {reqFlowCmdInfo} reqFlowCmdInfo
   */
  executeFlowControl(reqFlowCmdInfo) {
    try {
      // BU.CLIN(reqFlowCmdInfo, 1);
      this.cmdExecManager.executeFlowControl(reqFlowCmdInfo);
    } catch (error) {
      BU.error(error.message);
    }
  }
}
CoreFacade.dcmWsModel = dcmWsModel;
CoreFacade.dccFlagModel = dccFlagModel;
CoreFacade.dcmConfigModel = dcmConfigModel;

module.exports = CoreFacade;
