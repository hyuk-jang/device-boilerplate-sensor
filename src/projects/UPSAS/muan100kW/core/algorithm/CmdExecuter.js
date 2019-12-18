const _ = require('lodash');

const commonFn = require('./commonFn');

const { ndId, gDR, pNS, reqWCT } = commonFn;

// 취소 명령 종류
const cancelFlowCmdTypeInfo = {
  BOTH: 'BOTH',
  DRAINAGE: 'DRAINAGE',
  WATER_SUPPLY: 'WATER_SUPPLY',
};

module.exports = class {
  /** @param {CoreFacade} coreFacade */
  constructor(coreFacade) {
    this.coreFacade = coreFacade;
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

      // // BU.CLI(cancelFlowCmdType);
      // switch (cancelFlowCmdType) {
      //   case cancelFlowCmdTypeInfo.DRAINAGE:
      //     // 급수지 노드 목록 업데이트
      //     this.emitReloadPlaceStorage(destPlaceId);
      //     break;
      //   case cancelFlowCmdTypeInfo.WATER_SUPPLY:
      //     // 배수지 노드 목록 업데이트
      //     this.emitReloadPlaceStorage(srcPlaceId);
      //     break;
      //   case cancelFlowCmdTypeInfo.BOTH:
      //     // 배수지 노드 목록 업데이트
      //     this.emitReloadPlaceStorage(srcPlaceId);
      //     this.emitReloadPlaceStorage(destPlaceId);
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
   * 실행 중인 배수 명령 취소
   * @param {CmdStorage[]} cmdStorageList
   */
  cancelDrainage(cmdStorageList) {
    this.cancelWaterFlow(cmdStorageList, cancelFlowCmdTypeInfo.DRAINAGE);
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
   * Place Node에 갱신 이벤트를 보내고자 할 경우
   * @param {string} placeId Node Definition ID, 없을 경우 전체 갱신
   */
  emitReloadPlaceStorage(placeId) {
    // BU.CLI('emitReloadPlaceStorage', placeId);
    this.coreFacade.reloadPlaceStorage(placeId, [
      this.nodeDefIdInfo.SALINITY,
      this.nodeDefIdInfo.MODULE_REAR_TEMPERATURE,
      this.nodeDefIdInfo.WATER_LEVEL,
    ]);
  }
};
