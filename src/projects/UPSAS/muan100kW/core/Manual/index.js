const WaterLevel = require('./WaterLevel');
const Salinity = require('./Salinity');
const ModuleRearTemp = require('./ModuleRearTemp');

const CoreFacade = require('../../../../../core/CoreFacade');

const {
  constructorInfo: { CoreAlgorithm, PlaceComponent },
} = CoreFacade;

const { NODE_DEF } = require('../nodeDefInfo');

class Manual extends CoreAlgorithm {
  /** @param {CoreAlgorithm} algorithm */
  constructor(algorithm) {
    super();

    this.algorithm = algorithm;

    this.thresholdWL = new WaterLevel();
    this.thresholdS = new Salinity();
    this.thresholdMRT = new ModuleRearTemp();
  }

  /**
   * 제어 모드를 변경할 경우
   * @param {string} controlMode
   */
  updateControlMode(controlMode) {}

  /**
   * 노드 데이터 갱신
   * @param {CoreFacade} coreFacade Place Manager
   * @param {placeManager} placeManager Place Manager
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpdateNode(coreFacade, placeNode) {
    try {
      const nodeDefId = placeNode.getNodeDefId();

      let threAlgorithm;

      switch (nodeDefId) {
        case NODE_DEF.WATER_LEVEL:
          threAlgorithm = this.thresholdWL;
          break;
        case NODE_DEF.SALINITY:
          threAlgorithm = this.thresholdS;
          break;
        case NODE_DEF.MODULE_REAR_TEMPERATURE:
          threAlgorithm = this.thresholdMRT;
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
module.exports = Manual;
