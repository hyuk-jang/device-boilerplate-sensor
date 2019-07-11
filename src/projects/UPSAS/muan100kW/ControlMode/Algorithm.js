const { BU } = require('base-util-jh');

const AbstAlgorithm = require('./AbstAlgorithm');

const { nodeDefIdInfo: ndId } = AbstAlgorithm;
const PlaceComponent = require('../../../../core/PlaceManager/PlaceComponent');

const Manual = require('./Manual');
const SalternOptimization = require('./SalternOptimization');
const PowerOptimization = require('./PowerOptimization');
const Rain = require('./Rain');

class Algorithm extends AbstAlgorithm {
  constructor() {
    super();

    // 제어 모드 별 알고리즘 객체
    this.manualMode = new Manual(this);
    this.salternOptimizationMode = new SalternOptimization(this);
    this.powerOptimizationMode = new PowerOptimization(this);
    this.rainMode = new Rain(this);

    /** @type {Algorithm} */
    this.currControlMode = this.manualMode;
  }

  /**
   * 현재 제어 모드와 틀리다면 변경 후 제어모드 변경 알림
   * @param {Algorithm} controlMode
   */
  changeControlMode(controlMode) {
    if (this.currControlMode !== controlMode) {
      this.currControlMode = controlMode;
      this.currControlMode.updateControlMode();
      return true;
    }
    return false;
  }

  /** 수동 제어 모드로 변경 */
  setManualMode() {
    return this.changeControlMode(this.manualMode);
  }

  /** 소금 생산 최적화 제어 모드로 변경 */
  setSalternOptimizationMode() {
    return this.changeControlMode(this.salternOptimizationMode);
  }

  /** 발전 최적화 제어 모드로 변경 */
  setPowerOptimizationMode() {
    return this.changeControlMode(this.powerOptimizationMode);
  }

  /** 우천 제어 모드로 변경 */
  setRainMode() {
    return this.changeControlMode(this.rainMode);
  }

  /**
   * 제어 모드를 변경할 경우
   * @param {string} controlMode
   */
  updateControlMode(controlMode) {
    BU.CLI('updateControlMode', controlMode);
    let nextControlMode;

    //  제어 모드를 불러옴
    const {
      controlModeInfo: { MANUAL, SALTERN_POWER_OPTIMIZATION, POWER_OPTIMIZATION, RAIN },
    } = AbstAlgorithm;

    // 변경하고자 하는 제어모드 검색
    switch (controlMode) {
      // 수동 모드
      case MANUAL:
        nextControlMode = this.manualMode;
        break;
      // 소금 생산 최적화 모드
      case SALTERN_POWER_OPTIMIZATION:
        nextControlMode = this.salternOptimizationMode;
        break;
      // 발전 최적화 모드
      case POWER_OPTIMIZATION:
        nextControlMode = this.powerOptimizationMode;
        break;
      // 우천 모드
      case RAIN:
        nextControlMode = this.rainMode;
        break;
      default:
        nextControlMode = this.currControlMode;
        break;
    }

    return this.changeControlMode(nextControlMode);
  }

  /**
   * 현재 제어 모드 가져옴
   * @return {string} controlMode 제어 모드
   */
  getCurrControlMode() {}

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
      this.currControlMode.handleUpdateNode(coreFacade, placeNode);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Algorithm;
