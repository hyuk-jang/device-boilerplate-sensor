const _ = require('lodash');

const { BU } = require('base-util-jh');

const commonFn = require('./commonFn');

// const { ndId, pNS } = commonFn;
const { cmdStep, ndId, gDR, pNS, reqWCF, reqWCT } = commonFn;

module.exports = {
  /**
   * 지정 장소에서 배수 가능한 염수 량
   * 배수지에서 내보낼 수 있는 염수량에 관한 정보
   * @description
   * WV: Water Volume, 수량, m3
   * @param {PlaceStorage} drainagePlace
   * @param {string=} thresholdKey
   */
  getDrainageAbleWVInfo(drainagePlace, thresholdKey = pNS.MIN_UNDER) {
    // BU.CLIN(drainagePlace);
    const placeNode = drainagePlace.getPlaceNode(ndId.WATER_LEVEL);

    // BU.CLI(drainagePlace.getPlaceId());

    // 상한선
    const upperLimitValue = placeNode.getUpperLimitValue();
    // 설정치
    const setValue = placeNode.getSetValue();
    // 현재 값
    const currValue = placeNode.getNodeValue();
    // 하한선
    const lowerLimitValue = placeNode.getLowerLimitValue();
    // 최저치
    const minValue = placeNode.getMinValue();

    const drainageWVInfo = {
      // 최저 수위에 맞출 경우 염수량
      minWV: _.isNumber(minValue) ? commonFn.getCubicMeter(placeNode, minValue) : 0,
      // 하한선 수위에 맞출 경우 필요 염수량
      lowerLimitWV: _.isNumber(lowerLimitValue)
        ? commonFn.getCubicMeter(placeNode, lowerLimitValue)
        : 0,
      // 설정 수위에 맞출 경우 필요 염수량
      setWV: _.isNumber(setValue) ? commonFn.getCubicMeter(placeNode, setValue) : 0,
      // 배수를 할 수 있는 염수량
      drainageAbleWV: 0,
      // 현재 장소에 재급수를 하였을 경우 필요한 최소 염수량
      // 재급수 최소 필요 수위 = 하한선 + (설정 - 하한선) / 2
      drainageAfterNeedWV: 0,
    };
    // BU.CLI(drainagePlace.getPlaceId(), thresholdKey);
    // 배수 수위가 설정 수위이고 값이 존재하고 수위 상한선이 존재할 경우
    if (thresholdKey === pNS.NORMAL && _.isNumber(setValue) && _.isNumber(upperLimitValue)) {
      // 그 중간값을 최소 배수 염수량이라고 정함
      // 상한선과 설정 값의 50%를 최소 배수 수위로 함
      drainageWVInfo.drainageAbleWV = commonFn.getCubicMeter(
        placeNode,
        _.chain(upperLimitValue)
          .subtract(setValue)
          .divide(2)
          .add(setValue)
          .round(2)
          .thru(chainValue => _.subtract(currValue, chainValue))
          .value(),
      );
    } else {
      // 배수해야 하는 수위 하한선
      const lowerLimit = commonFn.getPlaceThresholdValue(
        drainagePlace,
        ndId.WATER_LEVEL,
        thresholdKey,
      );

      // 임계치가 존재하면 임계치로, 아니라면 최저로
      const thresholdValue = _.isNumber(lowerLimit) ? lowerLimit : minValue;

      if (_.isNumber(currValue) && _.isNumber(thresholdValue)) {
        drainageWVInfo.drainageAbleWV = commonFn.getCubicMeter(
          placeNode,
          _.subtract(currValue, thresholdValue),
        );
      }
    }

    // 배수 후 재급수 염수. 설정 수위와 하한선이 있다면 그 중간 값을 최소로 놓는다.
    if (_.isNumber(setValue) && _.isNumber(lowerLimitValue)) {
      drainageWVInfo.drainageAfterNeedWV = _.chain(drainageWVInfo.setWV)
        .subtract(drainageWVInfo.lowerLimitWV)
        .divide(2)
        .add(drainageWVInfo.lowerLimitWV)
        // .round(2)
        .value();
    } else if (_.isNumber(setValue)) {
      // 설정 수위만 존재한다면 그 염수량으로 지정
      drainageWVInfo.drainageAfterNeedWV = drainageWVInfo.setWV;
    }

    // BU.CLI(drainageWVInfo);
    return drainageWVInfo;
  },

  /**
   * 지정한 장소에서 급수 가능한 염수 량
   * @description
   * WV: Water Volume, 수량
   * @param {PlaceStorage} waterSupplyPlace
   * @param {string=} thresholdKey
   */
  getWaterSupplyAbleWV(waterSupplyPlace, thresholdKey) {
    // BU.CLI(waterSupplyPlace.getPlaceId(), thresholdKey);
    try {
      const placeNode = waterSupplyPlace.getPlaceNode(ndId.WATER_LEVEL);
      // 해당 장소에 수위가 없다면 무한대로 받을 수 있다고 가정(바다)
      if (placeNode === undefined) {
        return 10000;
      }

      // 최대치
      const maxValue = placeNode.getMaxValue();
      // 설정치
      const setValue = placeNode.getSetValue();
      // 현재 값
      const currValue = placeNode.getNodeValue();
      // 하한선
      const lowerLimitValue = placeNode.getLowerLimitValue();
      // // 최저치
      // const minValue = placeNode.getMinValue();

      // const waterSupplyWVInfo = {
      //   // 최저 수위에 맞출 경우 염수량
      //   minWV: _.isNumber(minValue) ? commonFn.getCubicMeter(placeNode, minValue) : 0,
      //   // 하한선 수위에 맞출 경우 필요 염수량
      //   lowerLimitWV: _.isNumber(lowerLimitValue)
      //     ? commonFn.getCubicMeter(placeNode, lowerLimitValue)
      //     : 0,
      //   // 설정 수위에 맞출 경우 필요 염수량
      //   setWV: _.isNumber(setValue) ? commonFn.getCubicMeter(placeNode, setValue) : 0,
      //   // 급수를 최대 할 수 있는 염수량
      //   waterSupplyAbleWV: 0,
      //   // 현재 장소에 재급수를 하였을 경우 필요한 최소 염수량
      //   // 재급수 최소 필요 수위 = 하한선 + (설정 - 하한선) / 2
      //   waterSupply: 0,
      // };

      // 급수 수위가 설정 수위이며 값이 존재하고 수위 하한선이 존재할 경우
      if (thresholdKey === pNS.NORMAL && _.isNumber(setValue) && _.isNumber(lowerLimitValue)) {
        // 그 중간값을 최소 급수 염수량이라고 정함
        return commonFn.getCubicMeter(
          placeNode,
          _.chain(setValue)
            .subtract(lowerLimitValue)
            .divide(2)
            .add(lowerLimitValue)
            .subtract(currValue)
            .round(2)
            .value(),
        );
      }
      // 받아야 하는 수위 상한선
      const upperLimit = commonFn.getPlaceThresholdValue(
        waterSupplyPlace,
        ndId.WATER_LEVEL,
        thresholdKey,
      );

      // 임계치가 존재하면 임계치로, 아니라면 최대치로
      const thresholdValue = _.isNumber(upperLimit) ? upperLimit : maxValue;

      if (_.isNumber(currValue) && _.isNumber(thresholdValue)) {
        return commonFn.getCubicMeter(placeNode, _.subtract(thresholdValue, currValue));
      }
    } catch (error) {
      throw error;
    }
  },
};
