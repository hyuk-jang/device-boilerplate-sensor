const { BU } = require('base-util-jh');

const PlaceAlgorithm = require('../../../../core/CoreAlgorithm');
const PlaceComponent = require('../../../../core/PlaceManager/PlaceComponent');

const WaterLevelThreAlgo = require('./WaterLevelThreAlgo');

class M100kPlaceAlgorithm extends PlaceAlgorithm {
  constructor() {
    super();

    this.waterLevelThreAlgo = new WaterLevelThreAlgo();
  }

  /**
   * 제어 모드를 변경할 경우
   * @param {string} controlMode
   */
  updateControlMode(controlMode) {
    BU.CLI('updateControlMode', controlMode);
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
        case PlaceComponent.nodeStatusInfo.MAX_OVER:
          selectedAlgorithmMethod = threAlgorithm.handleMaxOver;
          break;
        case PlaceComponent.nodeStatusInfo.UPPER_LIMIT_OVER:
          selectedAlgorithmMethod = threAlgorithm.handleUpperLimitOver;
          break;
        case PlaceComponent.nodeStatusInfo.NORMAL:
          selectedAlgorithmMethod = threAlgorithm.handleNormal;
          break;
        case PlaceComponent.nodeStatusInfo.LOWER_LIMIT_UNDER:
          selectedAlgorithmMethod = threAlgorithm.handleLowerLimitUnder;
          break;
        case PlaceComponent.nodeStatusInfo.MIN_UNDER:
          selectedAlgorithmMethod = threAlgorithm.handleMinUnder;
          break;
        case PlaceComponent.nodeStatusInfo.UNKNOWN:
          selectedAlgorithmMethod = threAlgorithm.handleUnknown;
          break;
        case PlaceComponent.nodeStatusInfo.ERROR:
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

module.exports = M100kPlaceAlgorithm;
