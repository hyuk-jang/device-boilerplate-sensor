const _ = require('lodash');

const { BU } = require('base-util-jh');

const {
  constructorInfo: { PlaceThreshold },
  dcmConfigModel,
} = require('../../../../../core/CoreFacade');

const { goalDataRange, reqWrapCmdType, placeNodeStatus: pNS } = dcmConfigModel;

const AbstAlgorithm = require('../AbstAlgorithm');

const { nodeDefIdInfo: ndId } = AbstAlgorithm;

const salinityFn = require('../commonFn/salinityFn');
const waterFlowFn = require('../commonFn/waterFlowFn');

class Salinity extends PlaceThreshold {
  /**
   * 장치 상태가 식별 불가 일 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleUnknown(coreFacade, placeNode) {}

  /**
   * 장치 상태가 에러일 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleError(coreFacade, placeNode) {}

  /**
   * Node 임계치가 상한선을 넘을 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpperLimitOver(coreFacade, placeNode) {
    try {
      BU.CLI('handleUpperLimitOver', placeNode.getPlaceId());

      // 염도 임계치 달성 시 이동할 장소 그룹
      const placeStorageList = placeNode.getGroupPlaceList();

      // BU.CLIN(placeStorageList, 1);

      // 그룹으로 묶인 증발지의 염도 및 수위가 충분한 지역이 50% 이상 여부 체크
      if (!salinityFn.isDpToWsp(placeStorageList)) {
        throw new Error(
          `Place: ${placeNode.getPlaceId()}.It is not a moveable brine threshold group.`,
        );
      }

      // DrainagePlace Drinage_Able WaterVolume
      const drainageWVInfo = _(placeStorageList)
        .map(placeStorage => waterFlowFn.getDrainageAbleWVInfo(placeStorage, pNS.MIN_UNDER))
        .reduce((prev, next) => {
          _.forEach(prev, (value, key) => {
            _.set(prev, key, _.sum([value, _.get(next, key)]));
          });
          return prev;
        });

      // BU.CLI(drainageWVInfo);

      // 배수지의 염수를 받을 수 있는 급수지를 탐색
      const waterSupplyInfo = salinityFn.getWaterSupplyAblePlace(
        placeNode,
        drainageWVInfo.drainageAbleWV,
      );
      // BU.CLIN(waterSupplyInfo);

      // 적정 급수지가 없다면 종료
      if (waterSupplyInfo.waterSupplyPlace === null) {
        throw new Error(
          `Place: ${placeNode.getPlaceId()}. There is no place to receive water at the place.`,
        );
      }
      // 재급수를 해야할 최소 염수량(재급수 필요 염수량 - 최저 염수량 - 배수 후 남아있는 염수량)
      const needWaterVolume =
        drainageWVInfo.drainageAfterNeedWV - drainageWVInfo.minWV - waterSupplyInfo.drainageAfterWV;

      BU.CLI(needWaterVolume);

      // 배수지에서 염수를 이동 후 적정 수위로 복원해줄 수 있는 해주 탐색(Base Place)
      const foundDrainagePlace = salinityFn.getDrainageAblePlace(placeNode, needWaterVolume);
      // BU.CLIN(foundDrainagePlace);

      // BP가 있다면 배수 명령 요청
      if (foundDrainagePlace) {
        placeStorageList.forEach(placeStorage => {
          coreFacade.executeFlowControl({
            wrapCmdType: reqWrapCmdType.CONTROL,
            srcPlaceId: placeStorage.getPlaceId(),
            destPlaceId: waterSupplyInfo.waterSupplyPlace.getPlaceId(),
            wrapCmdGoalInfo: {
              goalDataList: [
                {
                  nodeId: placeStorage.getNodeId(ndId.WATER_LEVEL),
                  goalValue: placeStorage.getMinValue(ndId.WATER_LEVEL),
                  goalRange: goalDataRange.LOWER,
                },
              ],
            },
          });
        });
      }

      // DP의 배수 후 급수 할 수위 하한선에 30%를 증가시킨 염수를 공급할 수 있는 장소 탐색
    } catch (error) {
      throw error;
    }
  }
}
module.exports = Salinity;
