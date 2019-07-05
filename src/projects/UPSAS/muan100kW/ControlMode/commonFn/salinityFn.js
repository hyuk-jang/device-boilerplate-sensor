const _ = require('lodash');

const { BU } = require('base-util-jh');

const AbstAlgorithm = require('../AbstAlgorithm');

const CoreFacade = require('../../../../../core/CoreFacade');

const { nodeDefIdInfo: ndId } = AbstAlgorithm;

const {
  dcmConfigModel: { reqWrapCmdType: reqWCT, placeNodeStatus, goalDataRange },
} = CoreFacade;

const coreFacade = new CoreFacade();

// 취소 명령 종류
const cancelFlowCmdTypeInfo = {
  BOTH: 'BOTH',
  DRAINAGE: 'DRAINAGE',
  WATER_SUPPLY: 'WATER_SUPPLY',
};

module.exports = {
  /**
   * 그룹으로 묶인 증발지의 염도 및 수위가 충분한 장소가 50%를 넘는지 체크
   * @param {PlaceStorage[]} placeGroupList
   */
  isDpToWsp(placeGroupList) {
    // BU.CLIN(placeGroupList)
    // 그룹의 염도 임계치 달성률 체크
    // 급수를 해올 수 있는 장소의 수위 상태
    const { UPPER_LIMIT_OVER } = placeNodeStatus;

    const drainageList = _.filter(placeGroupList, placeStorage => {
      // 염도 임계치에 도달
      // 염수 이동을 할 수 있는 염도 상태는 최대 치, 상한선 일 경우 가능함
      const isAbleS = _.includes([UPPER_LIMIT_OVER], placeStorage.getNodeStatus(ndId.SALINITY));
      // BU.CLI(isAbleS, placeStorage.getNodeValue(ndId.SALINITY));

      // 그룹의 수위가 하한선 * 10% 이상
      let isAbleWL = false;
      const placeNodeWL = placeStorage.getPlaceNode({ nodeDefId: ndId.WATER_LEVEL });
      if (_.isNumber(placeNodeWL.getNodeValue())) {
        // BU.CLIS(placeNodeWL.getNodeValue(), placeNodeWL.getLowerLimitValue() * 1.1);
        isAbleWL = placeNodeWL.getNodeValue() > placeNodeWL.getLowerLimitValue() * 1.1;
      }

      return isAbleS && isAbleWL;
    });

    return _.multiply(placeGroupList.length, 0.5) <= _.multiply(drainageList.length);
  },

  /**
   * 지정 장소에서 배수 가능한 염수 량
   * @description
   * WV: Water Volume, 수량, m3
   * @param {PlaceStorage} placeStorage
   */
  getDrainageAbleWV(placeStorage) {
    const placeNode = placeStorage.getPlaceNode({ nodeDefId: ndId.WATER_LEVEL });
    const drainageWV = {
      remainWV: 0,
      drainageAbleWV: 0,
    };
    if (_.isNumber(placeNode.getNodeValue()) && _.isNumber(placeNode.getUpperLimitValue())) {
      drainageWV.remainWV = _.chain(placeNode.getMinValue()) // 최저 수위는 항상 채워져 있다고 가정
        .multiply(0.01) // cm -> m
        .multiply(placeStorage.getSquareMeter()) // m3 환산
        .round(1) // 소수점 절삭
        .value(); // 데이터 반환,

      drainageWV.drainageAbleWV = _.chain(placeNode.getNodeValue())
        .subtract(placeNode.getMinValue()) // 현재 수위 - 최저 수위
        .multiply(0.01) // cm -> m
        .multiply(placeStorage.getSquareMeter()) // m3 환산
        .round(1) // 소수점 절삭
        .value(); // 데이터 반환
    }
    return drainageWV;
  },

  /**
   * 배수지로부터 염수를 공급 받을 수 있는 급수지를 찾고 결과를 예상한 후 반환
   * @param {PlaceNode} drainagePlaceNodeS 임계 염도가 발생한 원천 염도 노드
   * @param {number} drainageAbleWV 보낼 수 있는 염수량 (m3)
   */
  getWaterSupplyAblePlace(drainagePlaceNodeS, drainageAbleWV) {
    // 급수지의 장소 정보와 수용 가능한 급수량
    const resultDpToWsp = {
      // 급수지 장소
      waterSupplyPlace: null,
      // 급수지에서 받을 수 있는 염수량(m3)
      waterSupplyAbleWV: 0,
      // 배수지에서 염수를 보낸 후 남은 염수량(m3)
      drainageAfterWV: drainageAbleWV,
    };

    // 급수지는 보내오는 염수량의 30%는 받을 수 있는 해주를 대상으로 함
    const minimumDrainageWV = _.multiply(drainageAbleWV, 0.3);

    // 염도 임계치 목록 중에서 염수 이동이 가능한 급수지를 찾음
    _.find(drainagePlaceNodeS.getPutPlaceRankList(), waterSupplyStorage => {
      // 급수지에서 받을 수 있는 염수량 계산
      const waterSupplyAbleWV = this.getWaterSupplyAbleWV(waterSupplyStorage);
      // BU.CLI(waterSupplyAbleWV)

      // 보내는 염수량의 30%를 받을 수 있다면
      if (minimumDrainageWV < waterSupplyAbleWV) {
        // BU.CLIN(drainageAbleWV, waterSupplyAbleWV);
        const drainageRemainWV = drainageAbleWV - waterSupplyAbleWV;
        resultDpToWsp.waterSupplyPlace = waterSupplyStorage;
        resultDpToWsp.waterSupplyAbleWV = waterSupplyAbleWV;
        // 보내는 염수를 100% 수용할 수 있다면 남은 배수지의 이동 가능한 염수량은 0
        resultDpToWsp.drainageAfterWV = drainageRemainWV < 0 ? 0 : drainageRemainWV;
        return true;
      }
    });

    return resultDpToWsp;
  },

  /**
   * 원천지(Base Place)로부터 염수를 공급 받을 수 있는 급수지를 찾고 결과를 예상한 후 반환
   * @param {PlaceNode} waterSupplyPlaceNode 임계 염도가 발생한 원천 염도 노드
   * @param {number} waterSupplyAbleWV 받아야 하는 최소 염수량 (m3)
   */
  getDrainageAblePlace(waterSupplyPlaceNode, waterSupplyAbleWV) {
    // 수위를 급수할 수 있는 장소 목록을 가져옴
    const callPlaceList = waterSupplyPlaceNode.getCallPlaceRankList();

    // 급수지의 장소 정보와 수용 가능한 급수량
    const resultDpToWsp = {
      // 급수지 장소
      waterSupplyPlace: null,
      // 급수지에서 받을 수 있는 염수량(m3)
      waterSupplyAbleWV: 0,
      // 배수지에서 염수를 최대고 보내고 남은 염수량(m3)
      drainageRemainWV: waterSupplyAbleWV,
    };

    // 급수지는 보내오는 염수량의 30%는 받을 수 있는 해주를 대상으로 함
    const minimumDrainageWV = _.multiply(waterSupplyAbleWV, 0.3);

    // 염도 임계치 목록 중에서 염수 이동이 가능한 급수지를 찾음
    _.find(waterSupplyPlaceNode.getPutPlaceRankList(), waterSupplyStorage => {
      // 급수지에서 받을 수 있는 염수량 계산
      const waterSupplyAbleWV = this.getWaterSupplyAbleWV(waterSupplyStorage);
      // BU.CLI(waterSupplyAbleWV)

      // 보내는 염수량의 30%를 받을 수 있다면
      if (minimumDrainageWV < waterSupplyAbleWV) {
        // BU.CLIN(drainageAbleWV, waterSupplyAbleWV);
        const drainageRemainWV = waterSupplyAbleWV - waterSupplyAbleWV;
        resultDpToWsp.waterSupplyPlace = waterSupplyStorage;
        resultDpToWsp.waterSupplyAbleWV = waterSupplyAbleWV;
        // 보내는 염수를 100% 수용할 수 있다면 남은 배수지의 이동 가능한 염수량은 0
        resultDpToWsp.drainageRemainWV = drainageRemainWV < 0 ? 0 : drainageRemainWV;
        return true;
      }
    });

    return resultDpToWsp;
  },

  /**
   * 지정한 장소에서 급수 가능한 염수 량
   * @description
   * WV: Water Volume, 수량
   * @param {PlaceStorage} placeStorage
   */
  getWaterSupplyAbleWV(placeStorage) {
    // BU.CLI(placeStorage.getPlaceId());
    try {
      const placeNode = placeStorage.getPlaceNode({ nodeDefId: ndId.WATER_LEVEL });
      // 해당 장소에 수위가 없다면 무한대로 받을 수 있다고 가정(바다)
      if (placeNode === undefined) {
        return 10000;
      }
      if (_.isNumber(placeNode.getNodeValue()) && _.isNumber(placeNode.getMaxValue())) {
        // BU.CLIS(placeNode.getNodeValue(), placeNode.getMinValue(), placeStorage.getSquareMeter());
        return _.chain(placeNode.getMaxValue())
          .subtract(placeNode.getNodeValue()) // 최대 수위 - 현재 수위
          .multiply(0.01) // cm -> m
          .multiply(placeStorage.getSquareMeter()) // m3 환산
          .round(1) // 소수점 절삭
          .value(); // 데이터 반환
      }
    } catch (error) {
      throw error;
    }
  },

  /**
   * 그룹으로 묶인 증발지의 염도 및 수위가 충분한 장소가 50%를 넘는지 체크
   * @param {PlaceNode} placeNode
   */
  getWaterSupplyAblePlaces(placeNode) {},
};
