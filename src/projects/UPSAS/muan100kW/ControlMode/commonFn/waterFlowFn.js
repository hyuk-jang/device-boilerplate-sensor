const _ = require('lodash');

const { BU } = require('base-util-jh');

const commonFn = require('./commonFn');
const salinityFn = require('./salinityFn');

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
   * 염수를 이동시키고자 할 경우
   * @param {PlaceStorage} placeStorage 시작 장소 노드
   * @param {mThresholdInfo} thresholdInfo
   * @param {number=} ableWaterVolume
   * @param {PlaceStorage=} finalPlaceStorage
   */
  reqWaterFlow(placeStorage, thresholdInfo = {}, ableWaterVolume, finalPlaceStorage) {
    const { isCall, isGroup, value } = thresholdInfo;
    // 현재 장소로 급수를 하고자 할 경우
    if (isCall === true) {
      const isExecute = this.reqWaterSupply(placeStorage, ableWaterVolume);
      // 수위가 충분한 배수지가 없다면 배수지에 급수 요청
      if (!isExecute) {
        const drainagePlaceList = placeStorage
          .getPlaceNode(ndId.WATER_LEVEL)
          .getCallPlaceRankList();

        for (let index = 0; index < drainagePlaceList.length; index += 1) {
          const isRequest = this.reqWaterFlow(
            drainagePlaceList[index],
            thresholdInfo,
            null,
            finalPlaceStorage,
          );
          if (isRequest) break;
        }

        // drainagePlaceList.forEach(drainagePlace => {
        //   this.reqWaterFlow(drainagePlace, thresholdInfo)
        // })

        // this.reqWaterSupply(drainagePlaceList, ableWaterVolume, placeStorage);
      }
    }
    // 현재 장소에서 배수를 하고자 할 경우
    if (isCall === false) {
      return this.reqDrainage(placeStorage, ableWaterVolume);
    }
  },

  reqSimpleWaterSupply(waterSupplyPlaceNode) {},

  /**
   * 급수 명령 요청
   * 적합한 수위를 갖는 배수지가 없을 경우 배수지에 급수 요청
   * @param {PlaceStorage} waterSupplyPlace
   * @param {number=} needWaterVolume
   * @param {PlaceStorage=} finalWaterSupplyPlace
   */
  reqWaterSupply(waterSupplyPlace, needWaterVolume, finalWaterSupplyPlace) {
    // 급수 가능한 염수량이 없을 경우 계산
    if (!_.isNumber(needWaterVolume)) {
      // BU.CLIN(waterSupplyPlace);
      needWaterVolume = salinityFn.getWaterSupplyAbleWV(waterSupplyPlace);
    }
    // 급수지로 염수를 보낼 수 있는 배수지 목록을 가져옴
    const drainagePlaceList = waterSupplyPlace
      .getPlaceNode(ndId.WATER_LEVEL)
      .getCallPlaceRankList();

    // 배수지 목록을 순회하면서 염수 이동 조건에 부합하는 장소를 찾아 명령을 보낼때까지 순회
    for (let index = 0; index < drainagePlaceList.length; index += 1) {
      const drainagePlace = drainagePlaceList[index];

      if (_.isArray(drainagePlace)) {
        // 그냥 염수 이동 후 완료 처리
        drainagePlace.forEach(drainPlace => {
          // 배수지와 최종 급수지가 같을 경우에는 실행하지 않음
          if (drainPlace !== finalWaterSupplyPlace) {
            this.executeThresholdWaterSupply(drainPlace, waterSupplyPlace);
          }
        });
        return true;
      }

      // 최종 급수지가 존재하고 배수할려는 장소 객체와 같지 않을 경우에 실행
      if (drainagePlace !== finalWaterSupplyPlace) {
        const drainageWV = this.getDrainageAbleWV(drainagePlace);
        // BU.CLI(needWaterVolume, drainageWV);
        // 설정과 하한선의 중간 염수량을 만족할 수 있다면
        if (drainageWV.drainageAbleWV >= needWaterVolume) {
          this.executeThresholdWaterSupply(drainagePlace, waterSupplyPlace);
          return true;
        }
      }
    }

    // 모든 배수지가 조건에 부합되지 않았으므로 배수지에 염수 이동 요청
    // for (let index = 0; index < drainagePlaceList.length; index += 1) {
    //   const drainagePlace = drainagePlaceList[index];
    //   // 배수지에 급수 요청이 성공하였을 경우 종료
    //   if (this.reqWaterSupply(drainagePlace, null, finalWaterSupplyPlace)) {
    //     break;
    //   }
    // }
  },

  /**
   * 임계치에 의한 염수 이동 명령
   * 급수지에 설정 수위가 있을 경우에는 목표치 설정. 아닐 경우 목표치 없음
   * @param {PlaceStorage} drainagePlace
   * @param {PlaceStorage} waterSupplyPlace
   */
  executeThresholdWaterSupply(drainagePlace, waterSupplyPlace) {
    coreFacade.executeFlowControl(
      commonFn.makeWaterFlowCommand(
        {
          placeNode: drainagePlace,
        },
        {
          placeNode: waterSupplyPlace,
          goalValue: waterSupplyPlace.getSetValue(ndId.WATER_LEVEL),
          goalRange: goalDataRange.UPPER,
        },
      ),
    );
  },

  reqDrainage(drainagePlace, ableWaterVolume, finalDrainagePlace) {},

  /**
   * m3 으로 반환
   * @param {PlaceNode} placeNode
   * @param {number=} depthCm 수위가 지정안되어 있을 경우 현재 수위
   */
  getCubicMeter(placeNode, depthCm) {
    depthCm = _.isNil(depthCm) ? placeNode.getNodeValue() : depthCm;
    return _.chain(depthCm)
      .multiply(0.01)
      .multiply(placeNode.getSquareMeter())
      .round(1) // 소수점 절삭
      .value(); // 데이터 반환,
  },

  /**
   * 지정 장소에서 배수 가능한 염수 량
   * 배수지에서 내보낼 수 있는 염수량에 관한 정보
   * @description
   * WV: Water Volume, 수량, m3
   * @param {PlaceStorage} drainagePlace
   */
  getDrainageAbleWV(drainagePlace) {
    const placeNode = drainagePlace.getPlaceNode(ndId.WATER_LEVEL);

    const currValue = placeNode.getNodeValue();
    const minValue = placeNode.getMinValue();
    const lowerLimitValue = placeNode.getLowerLimitValue();
    const setValue = placeNode.getSetValue();

    const drainageWVInfo = {
      // 최저 수위에 맞출 경우 염수량
      minWV: _.isNumber(minValue) ? this.getCubicMeter(placeNode, minValue) : 0,
      // 하한선 수위에 맞출 경우 필요 염수량
      lowerLimitWV: _.isNumber(lowerLimitValue)
        ? this.getCubicMeter(placeNode, lowerLimitValue)
        : 0,
      // 설정 수위에 맞출 경우 필요 염수량
      setWV: _.isNumber(setValue) ? this.getCubicMeter(placeNode, setValue) : 0,
      // 배수를 할 수 있는 염수량 (현재 염수량 - 최저 염수량)
      drainageAbleWV: _.isNumber(currValue)
        ? this.getCubicMeter(
            placeNode,
            // 현재 수위 - 최저 수위
            currValue - minValue,
          )
        : 0,
      // 현재 장소에 재급수를 하였을 경우 필요한 최소 염수량
      // 재급수 최소 필요 수위 = 하한선 + (설정 - 하한선) / 2
      needWaterSupplyWV: 0,
    };
    // 배수 후 재급수 수위
    drainageWVInfo.needWaterSupplyWV = _.chain(drainageWVInfo.setWV)
      .subtract(drainageWVInfo.lowerLimitWV)
      .divide(2)
      .add(drainageWVInfo.lowerLimitWV)
      // .round(2)
      .value();

    return drainageWVInfo;
  },

  /**
   * 배수지로부터 가져올 수 있는 염수량에 관한 정보
   * @description
   * WV: Water Volume, 수량
   * @param {PlaceStorage} drainagePlace 배수지
   */
  getWaterSupplyAbleWV(drainagePlace) {
    // BU.CLI(placeStorage.getPlaceId());
    try {
      const placeNode = drainagePlace.getPlaceNode(ndId.WATER_LEVEL);
      // 해당 장소에 수위가 없다면 무한대로 받을 수 있다고 가정(바다)
      if (placeNode === undefined) {
        return 10000;
      }
      if (_.isNumber(placeNode.getNodeValue()) && _.isNumber(placeNode.getMaxValue())) {
        // BU.CLIS(placeNode.getNodeValue(), placeNode.getMinValue(), placeStorage.getSquareMeter());
        return _.chain(placeNode.getMaxValue())
          .subtract(placeNode.getNodeValue()) // 최대 수위 - 현재 수위
          .multiply(0.01) // cm -> m
          .multiply(drainagePlace.getSquareMeter()) // m3 환산
          .round(1) // 소수점 절삭
          .value(); // 데이터 반환
      }
    } catch (error) {
      throw error;
    }
  },
};
