const _ = require('lodash');

const { BU } = require('base-util-jh');

const { constructorInfo, dcmConfigModel } = require('../../../../../core/CoreFacade');

const { goalDataRange, reqWrapCmdType, placeNodeStatus } = dcmConfigModel;

const commonFn = require('../commonFn/commonFn');
const salinityFn = require('../commonFn/salinityFn');

const NODE_DEF_ID = 'salinity';
class Salinity extends constructorInfo.PlaceThreshold {
  /**
   * 장치 상태가 식별 불가 일 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUnknown(coreFacade, placeNode) {}

  /**
   * 장치 상태가 에러일 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleError(coreFacade, placeNode) {}

  /**
   * Node 임계치가 상한선을 넘을 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpperLimitOver(coreFacade, placeNode) {
    try {
      BU.CLI('handleUpperLimitOver', placeNode.getPlaceId());

      // 염도 임계치 달성 시 이동할 장소 그룹
      const placeGroupList = placeNode.getGroupSrcList();

      // 그룹으로 묶인 증발지의 염도 및 수위가 충분한 지역이 50% 이상 여부 체크
      if (!salinityFn.isDpToWsp(placeGroupList)) {
        throw new Error(
          `Place: ${placeNode.getPlaceId()}.It is not a moveable brine threshold group.`,
        );
      }
      // DrainagePlace Drinage_Able WaterVolume
      const drainageWVInfo = _(placeGroupList)
        .map(placeStorage => salinityFn.getDrainageAbleWV(placeStorage))
        .reduce((prev, next) => {
          return {
            drainageAbleWV: prev.drainageAbleWV + next.drainageAbleWV,
            remainWV: prev.remainWV + next.remainWV,
          };
        });

      // BU.CLI(drainageWVInfo);
      // 배수지의 염수를 받을 수 있는 급수지를 탐색
      const resultDpToWsp = salinityFn.getWaterSupplyAblePlace(
        placeNode,
        drainageWVInfo.drainageAbleWV,
      );
      // BU.CLIN(resultDpToWsp);

      if (resultDpToWsp.waterSupplyPlace === null) {
        throw new Error(`Place: ${placeNode.getPlaceId()}. There is no way to receive water.`);
      }

      // 배수지에서 염수를 이동 후 적정 수위로 복원해줄 수 있는 해주 탐색(Base Place)

      // DP의 배수 후 급수 할 수위 하한선에 30%를 증가시킨 염수를 공급할 수 있는 장소 탐색
    } catch (error) {
      throw error;
    }
  }
}
module.exports = Salinity;