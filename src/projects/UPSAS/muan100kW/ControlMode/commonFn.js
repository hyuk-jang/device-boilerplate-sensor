const _ = require('lodash');

const { BU } = require('base-util-jh');

const AbstAlgorithm = require('./AbstAlgorithm');

const CoreFacade = require('../../../../core/CoreFacade');

const {
  dcmConfigModel: { reqWrapCmdType: reqWCT, placeNodeStatus, goalDataRange },
} = CoreFacade;

const coreFacade = new CoreFacade();

const waterFlowTypeInfo = {
  NON: 'NON',
  PERFECT: 'PERFECT',
  TLLU: 'WS_GT_TS',
  TULO: 'NON',
}

// 취소 명령 종류
const cancelFlowCmdTypeInfo = {
  BOTH: 'BOTH',
  DRAINAGE: 'DRAINAGE',
  WATER_SUPPLY: 'WATER_SUPPLY',
};

module.exports = {
  /**
   * 실행 중인 흐름 명령 취소
   * @param {complexCmdWrapInfo|complexCmdWrapInfo[]} wrapCommand
   */
  cancelFlowCmd(wrapCommand, cancelFlowCmdType = cancelFlowCmdTypeInfo.BOTH) {
    // BU.CLI('cancelFlowCommandWaterSupply');
    // BU.CLIN(wrapCommand);
    if (Array.isArray(wrapCommand) && wrapCommand.length) {
      return wrapCommand.forEach(wrapCmdInfo => this.cancelFlowCmd(wrapCmdInfo, cancelFlowCmdType));
    }
    // 해당 염수 이동 명령 삭제 요청
    const cloneWrapCmdInfo = _.clone(wrapCommand);
    cloneWrapCmdInfo.wrapCmdType = reqWCT.CANCEL;
    coreFacade.executeFlowControl(cloneWrapCmdInfo);

    switch (cancelFlowCmdType) {
      case cancelFlowCmdTypeInfo.DRAINAGE:
        // 급수지 노드 목록 업데이트
        this.emitReloadPlaceStorage(cloneWrapCmdInfo.destPlaceId);
        break;
      case cancelFlowCmdTypeInfo.WATER_SUPPLY:
        // 배수지 노드 목록 업데이트
        this.emitReloadPlaceStorage(cloneWrapCmdInfo.srcPlaceId);
        break;
      case cancelFlowCmdTypeInfo.BOTH:
        // 배수지 노드 목록 업데이트
        this.emitReloadPlaceStorage(cloneWrapCmdInfo.srcPlaceId);
        this.emitReloadPlaceStorage(cloneWrapCmdInfo.destPlaceId);
        break;
      default:
        break;
    }
  },

  /**
   * 실행 중인 급수 명령 취소
   * @param {complexCmdWrapInfo|complexCmdWrapInfo[]} wrapCommand
   */
  cancelFlowCmdWaterSupply(wrapCommand) {
    // BU.CLI('cancelFlowCommandWaterSupply');
    this.cancelFlowCmd(wrapCommand, cancelFlowCmdTypeInfo.WATER_SUPPLY);
    return true;
  },

  /**
   * 실행 중인 배수 명령 취소
   * @param {complexCmdWrapInfo|complexCmdWrapInfo[]} wrapCommand
   */
  cancelFlowCmdDrainage(wrapCommand) {
    // BU.CLIN(wrapCommand);
    this.cancelFlowCmd(wrapCommand, cancelFlowCmdTypeInfo.DRAINAGE);
    return true;
  },

  /**
   * 실행 중인 급수 명령 취소
   * @param {PlaceComponent} placeNode
   * @param {boolean=} 목표치 도달 체크 여부
   * @return {boolean} 진행중인 급수 명령이 있다면 true, 없다면 false
   */
  cancelFlowCmdWaterSupplyGoal(placeNode, isGoalConfirm = false) {
    // 급수지 ID
    const waterSupplyPlaceId = placeNode.getPlaceId();

    const currFlowCmds = coreFacade.getFlowCommandList(null, waterSupplyPlaceId, reqWCT.CONTROL);

    // 진행 중인 배수 명령이 존재하지 않는다면 false
    if (!currFlowCmds.length) return false;

    // 배수를 진행하고 있는 명령 들 중 목표치가 없거나 달성됐다면 취소를 함
    currFlowCmds.forEach(flowCmdInfo => {
      // 목표치 확인은 있으나 아직 임계에 도달하지 못한다면 취소 명령 하지 않음
      if (isGoalConfirm && !coreFacade.isThreCmdClear(flowCmdInfo)) {
        return;
      }
      this.cancelFlowCmdWaterSupply(flowCmdInfo);
    });
    // 명령을 취소 처리할 수 있는 사항에 대해서 취소하였어도 남아있는 제어 명령이 있을경우 false
    return coreFacade.getFlowCommandList(null, waterSupplyPlaceId, reqWCT.CONTROL).length;
  },

  /**
   * 실행 중인 배수 명령 취소
   * @param {PlaceComponent} placeNode
   * @param {boolean=} 목표치 도달 체크 여부
   * @return {boolean} 진행중인 배수 명령이 있다면 true, 없다면 false
   */
  cancelFlowCmdDrainageGoal(placeNode, isGoalConfirm) {
    // 배수지 장소 Id
    const drainagePlaceId = placeNode.getPlaceId();

    const currFlowCmds = coreFacade.getFlowCommandList(drainagePlaceId, null, reqWCT.CONTROL);

    // 진행 중인 배수 명령이 존재하지 않는다면 false
    if (!currFlowCmds.length) return false;

    // 배수를 진행하고 있는 명령 들 중 목표치가 없거나 달성됐다면 취소를 함
    currFlowCmds.forEach(flowCmdInfo => {
      // 목표치 확인은 있으나 아직 임계에 도달하지 못한다면 취소 명령 하지 않음
      if (isGoalConfirm && !coreFacade.isThreCmdClear(flowCmdInfo)) {
        return;
      }
      this.cancelFlowCmdDrainage(flowCmdInfo);
    });
    // 명령을 취소 처리할 수 있는 사항에 대해서 취소하였어도 남아있는 제어 명령이 있을경우 false
    return coreFacade.getFlowCommandList(drainagePlaceId, null, reqWCT.CONTROL).length;
  },

  /**
   * 두 장소 사이에서 자동프로세스를 통한 자동 염수 이동 명령 생성
   * @param {PlaceComponent} srcPlace 데이터 갱신이 발생한 수위 노드
   * @param {PlaceComponent} destPlace 데이터 갱신이 발생한 수위 노드
   */
  makeWaterFlowCommand(srcPlace, destPlace) {
    /** @type {reqFlowCmdInfo} */
    const autoFlowCmd = {
      srcPlaceId: srcPlace.getPlaceId(),
      destPlaceId: destPlace.getPlaceId(),
      wrapCmdGoalInfo: {
        goalDataList: [
          _.isNumber(destPlace.getSetValue())
            ? {
                nodeId: destPlace.getNodeId(),
                goalValue: destPlace.getSetValue(),
                goalRange: goalDataRange.UPPER,
              }
            : {},
        ],
      },
    };
    return autoFlowCmd;
  },

  /**
   * 두 장소 사이에서 자동프로세스를 통한 자동 염수 이동 명령 생성
   * 배수지의 염수가 부족할 경우 이전 배수지의 우선 순위 1에서의 염수 이동 명령 요청
   * @param {Object} drainageConfig 배수지 정보
   * @param {PlaceComponent=} drainageConfig.drainagePlace 데이터 갱신이 발생한 노드
   * @param {number=} drainageConfig.goalType 임계치 값
   * @param {number=} drainageConfig.goalRange 임계치 범위
   * @param {Object=} waterSupplyConfig 급수지 정보
   * @param {Object=} waterFlowConfig.waterSupplyPlace 데이터 갱신이 발생한 노드
   * @param {number=} waterFlowConfig.goalType 임계치 값
   * @param {number=} waterFlowConfig.goalRange 임계치 범위
   * @param {boolean=} isForce 명령을 내릴 수 없는 상황이라면 이전 배수지의 우선 순위 1에서의 염수 이동 명령 요청 여부
   * @example
   * goalType
   * MAX_OVER: 'MAX_OVER',
   * UPPER_LIMIT_OVER: 'UPPER_LIMIT_OVER',
   * NORMAL: 'NORMAL',
   * LOWER_LIMIT_UNDER: 'LOWER_LIMIT_UNDER',
   * MIN_UNDER: 'MIN_UNDER',
   */
  executeWaterFlowCommand(drainageConfig = {}, waterFlowConfig = {}, isForce = false) {
    
    const { MAX_OVER, UPPER_LIMIT_OVER, NORMAL, LOWER_LIMIT_UNDER, MIN_UNDER } = placeNodeStatus;
    // 배수지와 급수지 간의 염수를 이동하고자 할 경우
    if (drainagePlace && waterSupplyPlace) {
      coreFacade.executeFlowControl(this.makeWaterFlowCommand(drainagePlace, waterSupplyPlace));
    }
    // 배수지만 지정할 경우: 지정한 장소에서 물을 뺌
    else if (drainagePlace) {
      const ablePlaceStorage = this.getAbleFlowCmdDrainage(drainagePlace);
      if (ablePlaceStorage) {
        // 염수 흐름 명령을 생성. (Src Place Id => Dest Place Id)
        coreFacade.executeFlowControl(this.makeWaterFlowCommand(drainagePlace, ablePlaceStorage));
      } else if (isForce) {
        // 강제로 염수를 공급할 1순위 급수지를 가져옴
        const putPlaceList = drainagePlace.getPutPlaceRankList();
        // 급수지 1랭크에 염수 이동 요청
        if (putPlaceList.length) {
          const putPlaceStorage = _.head(putPlaceList);
          this.executeWaterFlowCommand(putPlaceStorage, null);
        }
      }
    }
    // 급수지만 지정할 경우: 지정한 장소로 물을 채움
    else if (waterSupplyPlace) {
      // 급수지에 염수를 공급할 수 있는 배수지를 찾음
      const ablePlaceStorage = this.getAbleFlowCmdWaterSupply(waterSupplyPlace);
      if (ablePlaceStorage) {
        // 염수 흐름 명령을 생성. (Src Place Id => Dest Place Id)
        coreFacade.executeFlowControl(
          this.makeWaterFlowCommand(ablePlaceStorage, waterSupplyPlace),
        );
      } else if (isForce) {
        const callPlaceList = waterSupplyPlace.getCallPlaceRankList();
        // 배수지 1랭크에 염수 이동 요청
        if (callPlaceList.length) {
          const callPlaceStorage = _.head(callPlaceList);
          this.executeWaterFlowCommand(null, callPlaceStorage);
        }
      }
    }
  },

  /**
   * 현재 장소로 급수를 진행할 수 있는 배수지 검색 (배수지 수위가 충분해야함)
   * @param {PlaceComponent} placeNodeWL 데이터 갱신이 발생한 수위노드
   */
  getAbleFlowCmdWaterSupply(placeNodeWL) {
    // 하한선 수위가 존재하지 않는다면 종료
    if (!_.isNumber(placeNodeWL.getLowerLimitValue())) return false;

    // 수위 하한선에 걸렸기 때문에 수위를 급수할 수 있는 장소 목록을 가져옴
    const callPlaceList = placeNodeWL.getCallPlaceRankList();

    // 급수를 해올 수 있는 장소의 수위 상태
    const { MAX_OVER, UPPER_LIMIT_OVER, NORMAL } = placeNodeStatus;

    // 우선 배수지 장소 중 급수를 진행할 수 있는 장소 검색
    return _.find(callPlaceList, callPlaceStorage => {
      const nodeStatus = callPlaceStorage
        .getPlaceNode({ nodeDefId: placeNodeWL.getNodeDefId() })
        .getNodeStatus();

      // 급수를 할 수 있는 상태는 최대 치, 상한선, 기본 일 경우 가능함
      return _.includes([MAX_OVER, UPPER_LIMIT_OVER, NORMAL], nodeStatus);
    });
  },

  /**
   * 현재 장소에서 배수를 진행할 수 있는 급수지 검색 (급수지 수위가 충분해야함)
   * @param {PlaceComponent} placeNodeWL 데이터 갱신이 발생한 수위노드
   */
  getAbleFlowCmdDrainage(placeNodeWL) {
    // 상한선 수위가 존재하지 않는다면 종료
    if (!_.isNumber(placeNodeWL.getUpperLimitValue())) return false;

    // 수위 상한선에 걸렸기 때문에 수위를 배수할 수 있는 장소 목록을 가져옴
    const putPlaceList = placeNodeWL.getPutPlaceRankList();

    // 배수를 할 수 있는 장소의 수위 상태
    const { NORMAL, LOWER_LIMIT_UNDER, MIN_UNDER } = placeNodeStatus;

    // 우선 급수지 장소 중 배수를 진행할 수 있는 장소 검색
    return _.find(putPlaceList, putPlaceStorage => {
      const nodeStatus = putPlaceStorage
        .getPlaceNode({ nodeDefId: placeNodeWL.getNodeDefId() })
        .getNodeStatus();

      // 급수를 할 수 있는 상태는 기본, 하한선, 최저치 일 경우 가능함
      return _.includes([NORMAL, LOWER_LIMIT_UNDER, MIN_UNDER], nodeStatus);
    });
  },

  /**
   * Place Node에 갱신 이벤트를 보내고자 할 경우
   * @param {string} placeId Node Definition ID, 없을 경우 전체 갱신
   */
  emitReloadPlaceStorage(placeId) {
    const {
      nodeDefIdInfo: { SALINITY, MODULE_REAR_TEMPERATURE, WATER_LEVEL },
    } = AbstAlgorithm;

    coreFacade.reloadPlaceStorage(placeId, [SALINITY, MODULE_REAR_TEMPERATURE, WATER_LEVEL]);
  },
};
