const _ = require('lodash');

const { BU } = require('base-util-jh');

const { dcmWsModel, dccFlagModel, dcmConfigModel } = require('../module').di;

const AlgorithmComponent = require('./AlgorithmManager/AlgorithmComponent');

const PlaceComponent = require('./PlaceManager/PlaceComponent');
const PlaceThreshold = require('./AlgorithmManager/PlaceThreshold');

class CoreFacade {
  /**
   *
   * @param {MainControl} controller
   */
  constructor(controller) {
    this.controller = controller;
    this.model;
    this.cmdManager;
    this.cmdExecManager;
    this.placeManager;
    this.scenarioManager;

    this.coreAlgorithm = new AlgorithmComponent();
  }

  static get constructorInfo() {
    return {
      AlgorithmComponent,
      PlaceComponent,
      PlaceThreshold,
    };
  }

  /**
   * 명령 관리자 정의
   * @param {Model} model
   */
  setModel(model) {
    this.model = model;
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
   * 시나리오 관리자 정의
   * @param {ScenarioManager} scenarioManager
   */
  setScenarioManager(scenarioManager) {
    this.scenarioManager = scenarioManager;
  }

  /**
   * 장소 관리자 정의
   * @param {PlaceManager} placeManager
   */
  setPlaceManager(placeManager) {
    this.placeManager = placeManager;
  }

  /**
   * 명령 전략을 변경하고자 할 경우
   * @param {string} cmdMode 자동 명령 모드 여부
   */
  changeCmdStrategy(cmdMode) {
    // 명령 전략 변경.
    this.cmdManager.changeCmdStrategy(cmdMode);
  }

  /** @param {string} algorithmId 제어 모드 변경 알림 */
  changeOperationMode(algorithmId) {
    // 구동 모드 변경
    return this.coreAlgorithm.changeOperationMode(algorithmId);
  }

  /** 현재 명령 알고리즘(제어 모드) */
  getOperationConfig() {
    return this.coreAlgorithm.getOperationConfig();
  }

  /** @param {string} nodeId */
  getNodeInfo(nodeId) {
    return _.find(this.controller.nodeList, { node_id: nodeId });
  }

  /** 명령 모드 종류 */
  get cmdStrategyType() {
    return this.cmdManager.cmdStrategyType;
  }

  /** 현재 명령 모드 명 */
  getCurrCmdStrategyType() {
    return this.cmdManager.getCurrCmdStrategyType();
  }

  /**
   * 조건에 맞는 흐름 명령 반환
   * @param {string=} srcPlaceId 출발 장소 ID
   * @param {string=} destPlaceId 도착 장소 ID
   * @param {string=} wrapCmdType 명령 타입 CONTROL, CANCEL
   */
  getFlowCommandList(srcPlaceId = '', destPlaceId = '', wrapCmdType) {
    const where = {};
    _.isString(srcPlaceId) && srcPlaceId.length && _.assign(where, { srcPlaceId });
    _.isString(destPlaceId) && destPlaceId.length && _.assign(where, { destPlaceId });
    _.isString(wrapCmdType) && wrapCmdType.length && _.assign(where, { wrapCmdType });

    return this.cmdManager.getCmdStorageList(where);
  }

  /**
   *
   * @param {string|nodeInfo} node
   * @param {Observer} observer
   * @param {boolean=} isHeader 옵저버의 위치를 가장 앞쪽 배치 여부 (목표 달성부터 처리해야 할 때 사용)
   */
  attachNodeObserver(node, observer, isHeader) {
    this.controller.nodeUpdatorManager.attachNodeObserver(node, observer, isHeader);
  }

  /**
   * @param {nodeInfo|string} nodeInfo nodeId or nodeInfo 객체
   * @param {Observer} observer 옵저버 제거
   */
  dettachNodeObserver(node, observer) {
    this.controller.nodeUpdatorManager.dettachNodeObserver(node, observer);
  }

  /**
   * @desc Core Algorithm :::
   * @param {CoreAlgorithm} coreAlgorithm
   */
  setCoreAlgorithm(coreAlgorithm) {
    this.coreAlgorithm = coreAlgorithm;
  }

  /**
   * @desc Core Algorithm :::
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
    this.coreAlgorithm.handleUpdateNode(placeNode);
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
      // BU.CLIN(this.placeManager.getPlaceStorage(placeId))
      // BU.error(error);
      // BU.error(error);
    }
  }

  /**
   * 단일 명령을 내릴경우
   * 예외 발생 시 무시
   * @param {reqSingleCmdInfo} reqSingleCmdInfo
   */
  executeSingleControl(reqSingleCmdInfo) {
    try {
      return this.cmdExecManager.executeSingleControl(reqSingleCmdInfo);
    } catch (error) {
      BU.error(error.message);
    }
  }

  /**
   * 설정 명령을 내릴경우
   * 예외 발생 시 무시
   * @param {reqSetCmdInfo} reqSetCmdInfo
   */
  executeSetControl(reqSetCmdInfo) {
    try {
      return this.cmdExecManager.executeSetControl(reqSetCmdInfo);
    } catch (error) {
      BU.error(error.message);
    }
  }

  /**
   * Flow 명령을 내릴 경우 사용.
   * 예외 발생 시 무시
   * @param {reqFlowCmdInfo} reqFlowCmdInfo
   */
  executeFlowControl(reqFlowCmdInfo) {
    try {
      return this.cmdExecManager.executeFlowControl(reqFlowCmdInfo);
    } catch (error) {
      BU.error(error.message);
    }
  }

  /**
   * 시나리오를 수행하고자 할 경우
   * 예외 발생 시 무시
   * @param {reqScenarioCmdInfo} reqScenarioCmdInfo 시나리오 명령 정보
   */
  executeScenarioControl(reqScenarioCmdInfo) {
    try {
      return this.cmdExecManager.executeScenarioControl(reqScenarioCmdInfo);
    } catch (error) {
      BU.error(error.message);
    }
  }
}
CoreFacade.dcmWsModel = dcmWsModel;
CoreFacade.dccFlagModel = dccFlagModel;
CoreFacade.dcmConfigModel = dcmConfigModel;

module.exports = CoreFacade;
