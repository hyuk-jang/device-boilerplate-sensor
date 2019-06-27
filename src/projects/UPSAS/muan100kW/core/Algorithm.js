const { BU } = require('base-util-jh');

const CoreAlgorithm = require('../../../../core/CoreAlgorithm');
const PlaceComponent = require('../../../../core/PlaceManager/PlaceComponent');

const Manual = require('./Manual');
const SalternOptimization = require('./SalternOptimization');
const PowerOptimization = require('./PowerOptimization');
const Rain = require('./Rain');

// 제어 모드
const CONTROL_MODE = {
  MANUAL: 'MANUAL',
  POWER_OPTIMIZATION: 'POWER_OPTIMIZATION',
  SALTERN_POWER_OPTIMIZATION: 'SALTERN_POWER_OPTIMIZATION',
  RAIN: 'RAIN',
};

class Algorithm extends CoreAlgorithm {
  constructor() {
    super();

    this.algorithm = new Manual();

    // 제어 모드 별 알고리즘 객체
    this.manual = new Manual();
    this.salternOptimization = new SalternOptimization();
    this.powerOptimization = new PowerOptimization();
    this.rain = new Rain();
  }

  /**
   * 제어 모드를 변경할 경우
   * @param {string} controlMode
   */
  updateControlMode(controlMode) {
    BU.CLI('updateControlMode', controlMode);

    switch (controlMode) {
      case CONTROL_MODE.MANUAL:
        break;

      default:
        break;
    }
  }

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
      const srcPlaceNode = srcPlaceStorage.getPlaceNode({
        nodeDefId: 'waterLevel',
      });
      // 도착지의 수위 노드 객체
      const destPlaceNode = destPlaceStorage.getPlaceNode({
        nodeDefId: 'waterLevel',
      });

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

  /** */
  getPlaceStorageAlgorithm(placeStorage) {}

  /**
   * 노드 데이터 갱신
   * @param {CoreFacade} coreFacade Place Manager
   * @param {placeManager} placeManager Place Manager
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpdateNode(coreFacade, placeNode) {
    try {
      const { placeManager } = coreFacade;

      const nodeDefId = placeNode.getNodeDefId();

      let threAlgorithm;

      switch (nodeDefId) {
        case 'waterLevel':
          threAlgorithm = this.waterLevelThreAlgo;
          break;
        default:
          break;
      }

      if (!threAlgorithm) {
        // BU.CLI('알고리즘 없음');
        return false;
      }

      let selectedAlgorithmMethod = threAlgorithm.handleNormal;

      switch (placeNode.getNodeStatus()) {
        case PlaceComponent.nodeStatus.MAX_OVER:
          selectedAlgorithmMethod = threAlgorithm.handleMaxOver;
          break;
        case PlaceComponent.nodeStatus.UPPER_LIMIT_OVER:
          selectedAlgorithmMethod = threAlgorithm.handleUpperLimitOver;
          break;
        case PlaceComponent.nodeStatus.NORMAL:
          selectedAlgorithmMethod = threAlgorithm.handleNormal;
          break;
        case PlaceComponent.nodeStatus.LOWER_LIMIT_UNDER:
          selectedAlgorithmMethod = threAlgorithm.handleLowerLimitUnder;
          break;
        case PlaceComponent.nodeStatus.MIN_UNDER:
          selectedAlgorithmMethod = threAlgorithm.handleMinUnder;
          break;
        case PlaceComponent.nodeStatus.UNKNOWN:
          selectedAlgorithmMethod = threAlgorithm.handleUnknown;
          break;
        case PlaceComponent.nodeStatus.ERROR:
          selectedAlgorithmMethod = threAlgorithm.handleError;
          break;
        default:
          selectedAlgorithmMethod = threAlgorithm.handleNormal;
          break;
      }
      // 임계치에 맞는 메소드 호출. (this 인자를 잃으므로 지정 처리)
      selectedAlgorithmMethod.call(threAlgorithm, coreFacade, placeNode);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Algorithm;
