const _ = require('lodash');
const PlaceThreshold = require('../../../../core/AlgorithmManager/PlaceThreshold');

const commonFn = require('./algorithm/commonFn');

const { ndId, gDR, pNS, reqWCT } = commonFn;

// 취소 명령 종류
const cancelFlowCmdTypeInfo = {
  BOTH: 'BOTH',
  DRAINAGE: 'DRAINAGE',
  WATER_SUPPLY: 'WATER_SUPPLY',
};

module.exports = class extends PlaceThreshold {
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
  }

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
    // BU.CLI(waterSupplyPlace.getPlaceId(), thresholdKey);
    let { needWaterVolume } = waterSupplyInfo;
    // 급수 가능한 염수량이 없을 경우 계산
    if (!_.isNumber(needWaterVolume)) {
      needWaterVolume = waterFlowFn.getWaterSupplyAbleWV(waterSupplyPlace, thresholdKey);
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
        const drainageWV = waterFlowFn.getDrainageAbleWVInfo(drainagePlace);
        // BU.CLI(drainagePlace.getPlaceId(), drainageWV, needWaterVolume);
        // BU.CLI(needWaterVolume, drainageWV);
        // 설정과 하한선의 중간 염수량을 만족할 수 있다면
        if (drainageWV.drainageAbleWV >= needWaterVolume) {
          // 급수 요청
          this.executeWaterFlow(drainagePlace, waterSupplyPlace, false, thresholdKey);
          return true;
        }
      }
    }
  }

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
      const drainageWVInfo = waterFlowFn.getDrainageAbleWVInfo(drainagePlace, thresholdKey);
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
        const waterSupplyAbleWV = waterFlowFn.getWaterSupplyAbleWV(waterSupplyPlace, thresholdKey);
        // BU.CLI(waterSupplyAbleWV, needWaterVolume);

        // 설정과 하한선의 중간 염수량을 만족할 수 있다면
        if (waterSupplyAbleWV >= needWaterVolume) {
          // 배수 명령 요청
          this.executeWaterFlow(drainagePlace, waterSupplyPlace, true, thresholdKey);
          return true;
        }
      }
    }
  }

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
            goalRange: gDR.LOWER,
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
          goalRange: gDR.UPPER,
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
          goalRange: gDR.UPPER,
          isCompleteClear: true,
        });
      }
    }
    // 목표치 설정한 내용을 덮어씌움
    waterFlowCommand.wrapCmdGoalInfo.goalDataList = goalDataList;
    this.coreFacade.executeFlowControl(waterFlowCommand);
  }

  /**
   * 실행 중인 흐름 명령 취소
   * @param {CmdStorage[]} cmdStorageList
   */
  cancelWaterFlow(cmdStorageList, cancelFlowCmdType = cancelFlowCmdTypeInfo.BOTH) {
    if (_.isEmpty(cmdStorageList)) return true;

    cmdStorageList.forEach(cmdStorage => {
      const { srcPlaceId, destPlaceId } = cmdStorage;
      this.coreFacade.executeFlowControl({
        srcPlaceId,
        destPlaceId,
        wrapCmdType: reqWCT.CANCEL,
      });

      // BU.CLI(cancelFlowCmdType);
      // switch (cancelFlowCmdType) {
      //   case cancelFlowCmdTypeInfo.DRAINAGE:
      //     // 급수지 노드 목록 업데이트
      //     commonFn.emitReloadPlaceStorage(this.coreFacade, destPlaceId);
      //     break;
      //   case cancelFlowCmdTypeInfo.WATER_SUPPLY:
      //     // 배수지 노드 목록 업데이트
      //     commonFn.emitReloadPlaceStorage(this.coreFacade, srcPlaceId);
      //     break;
      //   case cancelFlowCmdTypeInfo.BOTH:
      //     // 배수지 노드 목록 업데이트
      //     commonFn.emitReloadPlaceStorage(this.coreFacade, srcPlaceId);
      //     commonFn.emitReloadPlaceStorage(this.coreFacade, destPlaceId);
      //     break;
      //   default:
      //     break;
      // }
    });
  }

  /**
   * 실행 중인 급수 명령 취소
   * @param {CmdStorage[]} cmdStorageList
   */
  cancelWaterSupply(cmdStorageList) {
    this.cancelWaterFlow(cmdStorageList, cancelFlowCmdTypeInfo.WATER_SUPPLY);
  }

  /**
   * 실행 중인 급수 명령 취소
   * @param {PlaceComponent} placeNode
   * @param {boolean=} 목표치 도달 체크 여부
   * @return {boolean} 진행중인 급수 명령이 있다면 true, 없다면 false
   */
  cancelWaterSupplyWithAlgorithm(placeNode, isGoalConfirm = false) {
    // 급수지 ID
    const waterSupplyPlaceId = placeNode.getPlaceId();

    // 실행 중인 염수 이동 명령 목록을 가져옴
    const cmdStorageList = this.coreFacade.cmdManager.getCmdStorageList({
      destPlaceId: waterSupplyPlaceId,
      wrapCmdType: reqWCT.CONTROL,
    });

    // 진행 중인 배수 명령이 존재하지 않는다면 false
    if (!cmdStorageList.length) return false;

    // 배수를 진행하고 있는 명령 들 중 조건에 따라 취소
    cmdStorageList.forEach(cmdStorage => {
      // 임계 명령을 체크하지 않을 경우
      if (!isGoalConfirm) {
        this.cancelWaterSupply([cmdStorage]);
      }
      // // 목표치 확인은 있으나 아직 임계에 도달하지 못한다면 취소 명령 하지 않음
      //   if (isGoalConfirm && !this.coreFacade.isThreCmdClear(cmdStorage)) {
      //     return;
      //   }
      // this.cancelWaterSupply(cmdStorage);
    });
    // 명령을 취소 처리할 수 있는 사항에 대해서 취소하였어도 남아있는 제어 명령이 있을경우 false

    // return this.coreFacade.getFlowCommandList(null, waterSupplyPlaceId, reqWCT.CONTROL).length;
  }

  /**
   * 실행 중인 배수 명령 취소
   * @param {CmdStorage[]} cmdStorageList
   */
  cancelDrainage(cmdStorageList) {
    this.cancelWaterFlow(cmdStorageList, cancelFlowCmdTypeInfo.DRAINAGE);
  }

  /**
   * 실행 중인 배수 명령 취소
   * @param {PlaceComponent} placeNode
   * @param {boolean=} 목표치 도달 체크 여부
   * @return {boolean} 진행중인 배수 명령이 있다면 true, 없다면 false
   */
  cancelDrainageWithAlgorithm(placeNode, isGoalConfirm) {
    // 배수지 장소 Id
    const drainagePlaceId = placeNode.getPlaceId();

    // 실행 중인 염수 이동 명령 목록을 가져옴
    const cmdStorageList = this.coreFacade.cmdManager.getCmdStorageList({
      srcPlaceId: drainagePlaceId,
      wrapCmdType: reqWCT.CONTROL,
    });

    // 진행 중인 배수 명령이 존재하지 않는다면 false
    if (!cmdStorageList.length) return false;

    cmdStorageList.forEach(cmdStorage => {
      // 임계 명령을 체크하지 않을 경우
      if (!isGoalConfirm) {
        this.cancelWaterSupply([cmdStorage]);
      }
      // // 목표치 확인은 있으나 아직 임계에 도달하지 못한다면 취소 명령 하지 않음
      //   if (isGoalConfirm && !coreFacade.isThreCmdClear(cmdStorage)) {
      //     return;
      //   }
      // this.cancelWaterSupply(cmdStorage);
    });

    // 배수를 진행하고 있는 명령 들 중 목표치가 없거나 달성됐다면 취소를 함
    // currFlowCmds.forEach(flowCmdInfo => {
    //   // 목표치 확인은 있으나 아직 임계에 도달하지 못한다면 취소 명령 하지 않음
    //   if (isGoalConfirm && !coreFacade.isThreCmdClear(flowCmdInfo)) {
    //     return;
    //   }
    //   this.cancelDrainage(flowCmdInfo);
    // });
    // // 명령을 취소 처리할 수 있는 사항에 대해서 취소하였어도 남아있는 제어 명령이 있을경우 false
    // return coreFacade.getFlowCommandList(drainagePlaceId, null, reqWCT.CONTROL).length;
  }
};
