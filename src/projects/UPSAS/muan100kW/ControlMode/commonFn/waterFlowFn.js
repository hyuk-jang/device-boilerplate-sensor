const _ = require('lodash');

const { BU } = require('base-util-jh');

const commonFn = require('./commonFn');

const AbstAlgorithm = require('../AbstAlgorithm');

const CoreFacade = require('../../../../../core/CoreFacade');

const { nodeDefIdInfo: ndId } = AbstAlgorithm;

const {
  dcmConfigModel: { reqWrapCmdType: reqWCT, placeNodeStatus: pNS, goalDataRange },
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
   * @param {string=} thresholdKey
   * @param {PlaceStorage=} finalPlaceStorage
   */
  reqWaterFlow(placeStorage, thresholdInfo = {}, thresholdKey) {
    const { isCall, isGroup, value } = thresholdInfo;
    // 현재 장소로 급수를 하고자 할 경우
    if (isCall === true) {
      const isExecute = this.reqWaterSupply({
        waterSupplyPlace: placeStorage,
        thresholdKey,
      });
      // 수위가 충분한 배수지가 없다면 배수지에 급수 요청
      if (!isExecute) {
        const drainagePlaceList = placeStorage
          .getPlaceNode(ndId.WATER_LEVEL)
          .getCallPlaceRankList();

        // 급수가 실패하였다면 배수지에 급수 요청
        for (let index = 0; index < drainagePlaceList.length; index += 1) {
          const isRequest = this.reqWaterSupply({
            waterSupplyPlace: _.nth(drainagePlaceList, index),
          });
          if (isRequest) {
            return true;
          }
        }
      }
    }
    // 현재 장소에서 배수를 하고자 할 경우
    if (isCall === false) {
      return this.reqDrainage({
        drainagePlace: placeStorage,
        thresholdKey,
      });
    }
  },

  /**
   * 급수 명령 요청
   * @param {Object} waterSupplyInfo
   * @param {PlaceStorage} waterSupplyInfo.waterSupplyPlace 급수지 장소
   * @param {number=} waterSupplyInfo.needWaterVolume 받아야 하는 물의 양
   * @param {string=} waterSupplyInfo.thresholdKey 급수지 수위 임계
   * @param {PlaceStorage=} finalWaterSupplyPlace 최종 급수지
   */
  reqWaterSupply(waterSupplyInfo, finalWaterSupplyPlace) {
    const { waterSupplyPlace, thresholdKey } = waterSupplyInfo;
    let { needWaterVolume } = waterSupplyInfo;
    // 급수 가능한 염수량이 없을 경우 계산
    if (!_.isNumber(needWaterVolume)) {
      needWaterVolume = this.getWaterSupplyAbleWV(waterSupplyPlace, thresholdKey);
    }
    // 급수지로 염수를 보낼 수 있는 배수지 목록을 가져옴
    const drainagePlaceList = waterSupplyPlace.getCallPlaceRankList(ndId.WATER_LEVEL);

    // 배수지 목록을 순회하면서 염수 이동 조건에 부합하는 장소를 찾아 명령을 보낼때까지 순회
    for (let index = 0; index < drainagePlaceList.length; index += 1) {
      const drainagePlace = drainagePlaceList[index];

      if (_.isArray(drainagePlace)) {
        // 그냥 염수 이동 후 완료 처리
        drainagePlace.forEach(drainPlace => {
          // 배수지와 최종 급수지가 같을 경우에는 실행하지 않음
          if (drainPlace !== finalWaterSupplyPlace) {
            // 급수 요청
            this.executeWaterFlow(drainPlace, waterSupplyPlace, false, thresholdKey);
          }
        });
        return true;
      }

      // 최종 급수지가 존재하고 배수할려는 장소 객체와 같지 않을 경우에 실행
      if (drainagePlace !== finalWaterSupplyPlace) {
        const drainageWV = this.getDrainageAbleWVInfo(drainagePlace);
        // BU.CLI(needWaterVolume, drainageWV);
        // 설정과 하한선의 중간 염수량을 만족할 수 있다면
        if (drainageWV.drainageAbleWV >= needWaterVolume) {
          // 급수 요청
          this.executeWaterFlow(drainagePlace, waterSupplyPlace, false, thresholdKey);
          return true;
        }
      }
    }
  },

  /**
   * 염수 이동 명령 생성
   * @param {PlaceStorage} drainagePlace 배수지 장소
   * @param {PlaceStorage} waterSupplyPlace 급수지 장소
   * @param {boolean=} isDrainageInvoker 현재 메소드를 요청한 주체가 배수지 장소인지 여부. 기본 값 true
   * @param {string=} thresholdKey
   * @example
   * isDrainageInvoker >>> true = 배수지에서 배수가 필요하여 명령을 요청할 경우
   * isDrainageInvoker >>> false = 급수지에서 급수가 필요하여 명령을 요청할 경우
   */
  executeWaterFlow(drainagePlace, waterSupplyPlace, isDrainageInvoker = true, thresholdKey = '') {
    /** @type {reqFlowCmdInfo} */
    const waterFlowCommand = {
      srcPlaceId: drainagePlace.getPlaceId(),
      destPlaceId: waterSupplyPlace.getPlaceId(),
      wrapCmdGoalInfo: {
        goalDataList: [],
      },
    };

    /** @type {csCmdGoalInfo[]} */
    const goalDataList = [];
    // 메소드를 요청한 주체가 배수지 일 경우
    if (isDrainageInvoker) {
      // 배수 임계치 키가 있을 경우
      if (thresholdKey.length) {
        const drainageGoal = commonFn.getPlaceThresholdValue(
          drainagePlace,
          ndId.WATER_LEVEL,
          thresholdKey,
        );
        // 목표치가 존재하고 숫자일 경우에 Goal 추가
        if (_.isNumber(drainageGoal)) {
          goalDataList.push({
            nodeId: drainagePlace.getNodeId(ndId.WATER_LEVEL),
            goalValue: drainageGoal,
            goalRange: goalDataRange.LOWER,
            isCompleteClear: true,
          });
        }
      }

      // 급수지의 설정 수위가 있는지 확인
      const waterSupplyGoal = commonFn.getPlaceThresholdValue(
        waterSupplyPlace,
        ndId.WATER_LEVEL,
        pNS.NORMAL,
      );
      // 급수지의 목표 설정 수위가 존재할 경우 Goal추가
      if (_.isNumber(waterSupplyGoal)) {
        goalDataList.push({
          nodeId: waterSupplyPlace.getNodeId(ndId.WATER_LEVEL),
          goalValue: waterSupplyGoal,
          goalRange: goalDataRange.UPPER,
          isCompleteClear: true,
        });
      }
    }
    // 메소드를 요청한 주체가 급수지이고 급수 임계치 키가 있을 경우
    else if (thresholdKey.length) {
      const waterSupplyGoal = commonFn.getPlaceThresholdValue(
        waterSupplyPlace,
        ndId.WATER_LEVEL,
        thresholdKey,
      );

      // 목표치가 존재하고 숫자일 경우에 Goal 추가
      if (_.isNumber(waterSupplyGoal)) {
        goalDataList.push({
          nodeId: waterSupplyPlace.getNodeId(ndId.WATER_LEVEL),
          goalValue: waterSupplyGoal,
          goalRange: goalDataRange.UPPER,
          isCompleteClear: true,
        });
      }
    }
    // 목표치 설정한 내용을 덮어씌움
    waterFlowCommand.wrapCmdGoalInfo.goalDataList = goalDataList;
    coreFacade.executeFlowControl(waterFlowCommand);
  },

  /**
   * 배수 명령 요청
   * @param {Object} drainageInfo
   * @param {PlaceStorage} drainageInfo.drainagePlace 배수지 장소
   * @param {number=} drainageInfo.needWaterVolume 보내야 하는 물의 양
   * @param {string=} drainageInfo.thresholdKey 배수지 수위 임계
   * @param {PlaceStorage=} finalWaterSupplyPlace 최종 배수지
   */
  reqDrainage(drainageInfo, finalDrainagePlace) {
    // BU.CLI('reqDrainage');
    const { drainagePlace, thresholdKey } = drainageInfo;
    // BU.CLI(thresholdKey);
    // BU.CLIN(drainagePlace, 1);
    let { needWaterVolume } = drainageInfo;
    // BU.CLI(needWaterVolume);
    // 급수 가능한 염수량이 없을 경우 계산
    if (!_.isNumber(needWaterVolume)) {
      // BU.CLIN(waterSupplyPlace);
      const drainageWVInfo = this.getDrainageAbleWVInfo(drainagePlace, thresholdKey);
      needWaterVolume = drainageWVInfo.drainageAbleWV;
    }
    // BU.CLI(needWaterVolume);
    // 배수지에서 염수를 보낼 수 있는 급수지 목록을 가져옴
    const waterSupplyPlaceList = drainagePlace.getPutPlaceRankList(ndId.WATER_LEVEL);

    // 배수지 목록을 순회하면서 염수 이동 조건에 부합하는 장소를 찾아 명령을 보낼때까지 순회
    for (let index = 0; index < waterSupplyPlaceList.length; index += 1) {
      const waterSupplyPlace = waterSupplyPlaceList[index];

      if (_.isArray(waterSupplyPlace)) {
        // 그냥 염수 이동 후 완료 처리
        waterSupplyPlace.forEach(wsPlace => {
          // 급수지와 최종 배수지가 같을 경우에는 실행하지 않음
          if (wsPlace !== finalDrainagePlace) {
            // 배수 명령 요청
            this.executeWaterFlow(drainagePlace, waterSupplyPlace, true, thresholdKey);
          }
        });
        return true;
      }

      // 최종 급수지가 존재하고 배수할려는 장소 객체와 같지 않을 경우에 실행
      if (waterSupplyPlace !== finalDrainagePlace) {
        const waterSupplyAbleWV = this.getWaterSupplyAbleWV(waterSupplyPlace);
        // BU.CLI(waterSupplyAbleWV, needWaterVolume);

        // 설정과 하한선의 중간 염수량을 만족할 수 있다면
        if (waterSupplyAbleWV >= needWaterVolume) {
          // 배수 명령 요청
          this.executeWaterFlow(drainagePlace, waterSupplyPlace, true, thresholdKey);
          return true;
        }
      }
    }
  },

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

    return drainageWVInfo;
  },

  /**
   * 지정한 장소에서 급수 가능한 염수 량
   * @description
   * WV: Water Volume, 수량
   * @param {PlaceStorage} waterSupplyPlace
   * @param {string=} thresholdKey
   */
  getWaterSupplyAbleWV(waterSupplyPlace, thresholdKey = pNS.MAX_OVER) {
    // BU.CLI(placeStorage.getPlaceId());
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
