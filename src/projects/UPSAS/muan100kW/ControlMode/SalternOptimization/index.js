const WaterLevel = require('./WaterLevel');
const Salinity = require('./Salinity');
const ModuleRearTemp = require('./ModuleRearTemp');

const AbstAlgorithm = require('../AbstAlgorithm');

const CoreFacade = require('../../../../../core/CoreFacade');

const {
  constructorInfo: { PlaceComponent },
} = CoreFacade;

class ConcreteAlgorithm extends AbstAlgorithm {
  /** @param {AbstAlgorithm} controlAlgorithm */
  constructor(controlAlgorithm) {
    super();

    this.controlAlgorithm = controlAlgorithm;

    this.thresholdWL = new WaterLevel();
    this.thresholdS = new Salinity();
    this.thresholdMRT = new ModuleRearTemp();
  }

  /**
   * 제어 모드가 변경된 경우
   */
  updateControlMode() {
    const coreFacade = new CoreFacade();
    // 현재 명령 모드가 수동이 아니라면 수동 명령 모드로 변경
    if (coreFacade.getCurrCmdStrategyType() !== coreFacade.cmdStrategyType.MANUAL) {
      coreFacade.changeCmdStrategy(coreFacade.cmdStrategyType.MANUAL);
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
      const { NODE_DEF } = AbstAlgorithm;

      const { nodeStatusInfo: nodeStatus } = PlaceComponent;

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
        case nodeStatus.MAX_OVER:
          selectedAlgorithmMethod = threAlgorithm.handleMaxOver;
          break;
        case nodeStatus.UPPER_LIMIT_OVER:
          selectedAlgorithmMethod = threAlgorithm.handleUpperLimitOver;
          break;
        case nodeStatus.NORMAL:
          selectedAlgorithmMethod = threAlgorithm.handleNormal;
          break;
        case nodeStatus.LOWER_LIMIT_UNDER:
          selectedAlgorithmMethod = threAlgorithm.handleLowerLimitUnder;
          break;
        case nodeStatus.MIN_UNDER:
          selectedAlgorithmMethod = threAlgorithm.handleMinUnder;
          break;
        case nodeStatus.UNKNOWN:
          selectedAlgorithmMethod = threAlgorithm.handleUnknown;
          break;
        case nodeStatus.ERROR:
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
module.exports = ConcreteAlgorithm;
