const _ = require('lodash');

const { BU } = require('base-util-jh');

const { nodeDefIdInfo: ndId } = require('./commonFn');

const CoreFacade = require('../../../../../core/CoreFacade');

const {
  dcmConfigModel: { placeNodeStatus: pNS },
} = CoreFacade;

const waterFlowFn = require('./waterFlowFn');

module.exports = {
  /**
   * 그룹으로 묶인 증발지의 염도 및 수위가 충분한 장소가 50%를 넘는지 체크
   * @param {PlaceStorage[]} placeGroupList
   */
  isDpToWsp(placeGroupList) {
    // BU.CLIN(placeGroupList)
    // 그룹의 염도 임계치 달성률 체크
    // 급수를 해올 수 있는 장소의 수위 상태
    const { UPPER_LIMIT_OVER } = pNS;

    const drainageList = _.filter(placeGroupList, placeStorage => {
      // 염도 임계치에 도달
      // 염수 이동을 할 수 있는 염도 상태는 상한선 일 경우 가능함
      const isReachSalinity = _.includes(
        [UPPER_LIMIT_OVER],
        placeStorage.getNodeStatus(ndId.SALINITY),
      );
      // BU.CLI(isAbleS, placeStorage.getNodeValue(ndId.SALINITY));

      // 그룹의 수위가 하한선 수치 이상일 경우
      let isReachWaterLevel = false;
      const placeNodeWL = placeStorage.getPlaceNode(ndId.WATER_LEVEL);
      if (_.isNumber(placeNodeWL.getNodeValue())) {
        isReachWaterLevel = placeNodeWL.getNodeValue() >= placeNodeWL.getLowerLimitValue();
      }

      return isReachSalinity && isReachWaterLevel;
    });

    return _.divide(placeGroupList.length, 2) <= drainageList.length;
  },

  /**
   * 배수지로부터 염수를 공급 받을 수 있는 급수지를 찾고 결과를 예상한 후 반환
   * @param {PlaceNode} drainagePlaceNode 임계 염도가 발생한 원천 염도 노드
   * @param {number} drainageAbleWV 보낼 수 있는 염수량 (m3)
   */
  getWaterSupplyAblePlace(drainagePlaceNode, drainageAbleWV) {
    // 급수지의 장소 정보와 수용 가능한 급수량
    const waterSupplyInfo = {
      // 급수지 장소
      /** @type {PlaceStorage} */
      waterSupplyPlace: null,
      // 급수지에서 받을 수 있는 염수량(m3)
      waterSupplyAbleWV: 0,
      // 배수지에서 염수를 보낸 후 남은 염수량(m3)
      drainageAfterWV: drainageAbleWV,
    };

    // 급수지는 보내오는 염수량의 30%는 받을 수 있는 해주를 대상으로 함
    const minimumDrainageWV = _.multiply(drainageAbleWV, 0.3);

    // 염도 임계치 목록 중에서 염수 이동이 가능한 급수지를 찾음
    _.find(drainagePlaceNode.getPutPlaceRankList(), waterSupplyStorage => {
      // 급수지에서 받을 수 있는 염수량 계산
      const waterSupplyAbleWV = waterFlowFn.getWaterSupplyAbleWV(waterSupplyStorage, pNS.MAX_OVER);
      // BU.CLI(waterSupplyAbleWV)

      // 보내는 염수량의 30%를 받을 수 있다면
      if (minimumDrainageWV < waterSupplyAbleWV) {
        // BU.CLIN(drainageAbleWV, waterSupplyAbleWV);
        // 배수 후 남은 염수량(배수지)
        const drainageAfterWV = drainageAbleWV - waterSupplyAbleWV;
        waterSupplyInfo.waterSupplyPlace = waterSupplyStorage;
        waterSupplyInfo.waterSupplyAbleWV = waterSupplyAbleWV;
        // 보내는 염수를 100% 수용할 수 있다면 남은 배수지의 이동 가능한 염수량은 0
        waterSupplyInfo.drainageAfterWV = drainageAfterWV < 0 ? 0 : drainageAfterWV;
        return true;
      }
    });

    return waterSupplyInfo;
  },

  /**
   * 원천지(Base Place)로부터 염수를 공급 받을 수 있는 급수지를 찾고 결과를 예상한 후 반환
   * @param {PlaceNode} waterSupplyPlaceNode 임계 염도가 발생한 원천 염도 노드
   * @param {number} needWaterVolume 받아야 하는 염수량 (m3)
   * @return {PlaceStorage[]|PlaceStorage[][]}
   */
  getDrainageAblePlace(waterSupplyPlaceNode, needWaterVolume) {
    // BU.CLI(waterSupplyPlaceNodeS.getPlaceId(), needWaterVolume);
    // 급수지의 장소 정보와 수용 가능한 급수량
    let drainagePlace;

    const placeNodeWL = waterSupplyPlaceNode.getPlaceNode(ndId.WATER_LEVEL);

    // 염도 임계치 목록 중에서 염수 이동이 가능한 급수지를 찾음
    _.some(placeNodeWL.getCallPlaceRankList(), drainageStorage => {
      // 급수지에서 받을 수 있는 염수량 계산
      const drainageWVInfo = waterFlowFn.getDrainageAbleWVInfo(drainageStorage, pNS.MIN_UNDER);

      // 설정과 하한선의 중간 염수량을 만족할 수 있다면
      if (drainageWVInfo.drainageAbleWV >= needWaterVolume) {
        drainagePlace = drainageStorage;
        return true;
      }
    });

    return drainagePlace;
  },
};
