const _ = require('lodash');

const { BU } = require('base-util-jh');

const AlgorithmStorage = require('../../../../core/AlgorithmManager/AlgorithmStorage');

// const { nodeDefIdInfo: ndId } = AlgorithmComponent;

const ndId = {
  WATER_LEVEL: 'waterLevel',
  SALINITY: 'salinity',
  MODULE_REAR_TEMPERATURE: 'moduleRearTemperature',
};

class Algorithm extends AlgorithmStorage {
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
}

module.exports = Algorithm;
