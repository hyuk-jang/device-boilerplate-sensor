const _ = require('lodash');

const { BU } = require('base-util-jh');

const AbstAlgorithm = require('./AbstAlgorithm');

const { nodeDefIdInfo: ndId } = AbstAlgorithm;
const CoreFacade = require('../../../../core/CoreFacade');
const PlaceComponent = require('../../../../core/PlaceManager/PlaceComponent');

const Manual = require('./Manual');
const SalternOptimization = require('./SalternOptimization');
const PowerOptimization = require('./PowerOptimization');

class Algorithm extends AbstAlgorithm {
  constructor() {
    super();

    /** @type {AbstAlgorithm[]} */
    this.operationModeList = [];
    /** @type {AbstAlgorithm} */
    this.operationMode = {};

    // 제어 모드 별 알고리즘 객체
    this.manualMode = new Manual(this);
    this.salternOptimizationMode = new SalternOptimization(this);
    this.powerOptimizationMode = new PowerOptimization(this);

    // /** @type {Algorithm} */
    // this.currControlMode = this.manualMode;

    this.changeOperationMode(this.manualMode.algorithmId);
  }

  /**
   * 구동 모드 객체를 추가함
   * @param {AbstAlgorithm} algorithmMode
   */
  addOperationMode(algorithmMode) {
    // 이미 존재한다면 false 반환
    if (_.findIndex(this.operationModeList, algorithmMode) !== -1) return false;

    // 삽입 후 true 반환
    return this.operationModeList.push(algorithmMode) && true;
  }

  /**
   * 구동 모드를 알고리즘 Id로 찾아와서 반환
   * @param {string} algorithmId
   * @return {AlgorithmComponent}
   */
  getOperationMode(algorithmId) {
    return _.find(this.operationModeList, operationMode => {
      return operationMode.algorithmId === algorithmId;
    });
  }

  /**
   * 구동 모드를 변경할 경우(Api Server에서 요청)
   * @param {string} algorithmId 제어 모드
   */
  changeOperationMode(algorithmId = AbstAlgorithm.controlModeInfo.MANUAL) {
    try {
      // 구동 모드 객체를 가져옴
      const operationMode = this.getOperationMode(algorithmId);

      // 구동 모드가 존재하지 않을 경우
      if (_.isEmpty(operationMode)) {
        throw new Error(`algorithmId: (${operationMode}) is not exist.`);
      }
      // 구동 모드가 동일 할 경우
      if (operationMode === this.operationMode) {
        throw new Error(`algorithmId: (${operationMode}) is the same operation mode.`);
      }

      // 구동 모드 변경
      this.operationMode = operationMode;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 구동 모드를 변경할 경우
   * @param {string} algorithmId
   */
  changeOperationMode2(algorithmId = AbstAlgorithm.controlModeInfo.MANUAL) {
    // BU.CLI('updateControlMode', controlMode);

    // _.find(this.operationModeList, { o });

    /** @type {AbstAlgorithm} */
    let nextOperAlgorithm;

    // 제어 모드를 불러옴
    const {
      controlModeInfo: { MANUAL, SALTERN_OPTIMIZATION, POWER_OPTIMIZATION, RAIN },
    } = AbstAlgorithm;

    // BU.CLI('controlMode', controlMode);

    // 변경하고자 하는 제어모드 검색
    switch (algorithmId) {
      // 수동 모드
      case MANUAL:
        nextOperAlgorithm = this.manualMode;
        break;
      // 소금 생산 최적화 모드
      case SALTERN_OPTIMIZATION:
        nextOperAlgorithm = this.salternOptimizationMode;
        break;
      // 발전 최적화 모드
      case POWER_OPTIMIZATION:
        nextOperAlgorithm = this.powerOptimizationMode;
        break;
      // 우천 모드
      case RAIN:
        nextOperAlgorithm = this.scenarioMode;
        break;
      default:
        nextOperAlgorithm = this.operationAlgorithm;
        break;
    }

    // BU.CLIN(nextControlMode);

    // 구동 알고리즘 모드 정보를 설정
    this.operationModeInfo = nextOperAlgorithm.operationModeInfo;

    // this.algorithmId = nextOperAlgorithm.algorithmId;
    // this.algorithmName = nextOperAlgorithm.algorithmName;

    return this.updateOperationMode(nextOperAlgorithm);
  }

  /**
   * 현재 제어 모드와 틀리다면 변경 후 제어모드 변경 알림
   * @param {Algorithm} operationAlgorithm
   */
  updateOperationMode(operationAlgorithm) {
    // BU.CLIS(this.currControlMode, controlMode);
    if (this.operationAlgorithm !== operationAlgorithm) {
      this.operationAlgorithm = operationAlgorithm;
      // 세부 모드 별 알고리즘에 제어 모드 변경 알림 처리
      this.operationAlgorithm.updateOperationMode();
      return true;
    }
    return false;
  }

  /** 수동 제어 모드로 변경 */
  setManualMode() {
    return this.updateOperationMode(this.manualMode);
  }

  /** 소금 생산 최적화 제어 모드로 변경 */
  setSalternOptimizationMode() {
    return this.updateOperationMode(this.salternOptimizationMode);
  }

  /** 발전 최적화 제어 모드로 변경 */
  setPowerOptimizationMode() {
    return this.updateOperationMode(this.powerOptimizationMode);
  }

  /** 우천 제어 모드로 변경 */
  setRainMode() {
    return this.updateOperationMode(this.scenarioMode);
  }

  // /**
  //  * 현재 제어 모드 가져옴
  //  * @return {string} controlMode 제어 모드
  //  */
  // get algorithmId() {
  //   //  제어 모드를 불러옴
  //   const {
  //     controlModeInfo: { MANUAL, SALTERN_OPTIMIZATION, POWER_OPTIMIZATION },
  //   } = AbstAlgorithm;

  //   let controlMode;

  //   if (this.currControlMode === this.manualMode) {
  //     controlMode = MANUAL;
  //   } else if (this.currControlMode === this.salternOptimizationMode) {
  //     controlMode = SALTERN_OPTIMIZATION;
  //   } else if (this.currControlMode === this.powerOptimizationMode) {
  //     controlMode = POWER_OPTIMIZATION;
  //   }

  //   return controlMode;
  // }

  /**
   * 흐름 명령을 수행할 수 있는지 여부 체크
   * @param {PlaceManager} placeManager
   * @param {string} srcPlaceId
   * @param {string} destPlaceId
   * @param {csCmdGoalInfo=} goalInfo
   */
  isPossibleFlowCommand(placeManager, srcPlaceId, destPlaceId, goalInfo) {
    // BU.CLI('isPossibleFlowCommand', srcPlaceId, destPlaceId);

    try {
      // 시작지의 장소 정보
      const srcPlaceStorage = placeManager.getPlaceStorage(srcPlaceId);
      // 도착지의 장소 정보
      const destPlaceStorage = placeManager.getPlaceStorage(destPlaceId);

      // 시작지의 수위 노드 객체
      const srcPlaceNode = srcPlaceStorage.getPlaceNode(ndId.WATER_LEVEL);
      // 도착지의 수위 노드 객체
      const destPlaceNode = destPlaceStorage.getPlaceNode(ndId.WATER_LEVEL);

      // 시작지의 수위가 최저 수위
      if (srcPlaceNode.getNodeValue() <= srcPlaceNode.getMinValue()) {
        throw new Error(
          `The water level of the srcPlaceId: ${srcPlaceId} is below the minimum water level.`,
        );
      }

      // 배수지의 수위가 최대를 넘어섰을 경우
      if (destPlaceNode.getNodeValue() >= destPlaceNode.getMaxValue()) {
        throw new Error(
          `The water level of the destPlaceId: ${destPlaceId} is over the max water level.`,
        );
      }
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 노드 데이터 갱신
   * @param {CoreFacade} coreFacade Place Manager
   * @param {placeManager} placeManager Place Manager
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpdateNode(coreFacade, placeNode) {
    try {
      this.operationAlgorithm.handleUpdateNode(coreFacade, placeNode);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Algorithm;
