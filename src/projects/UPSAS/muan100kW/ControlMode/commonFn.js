const _ = require('lodash');

const { BU } = require('base-util-jh');

const AbstAlgorithm = require('./AbstAlgorithm');

const CoreFacade = require('../../../../core/CoreFacade');

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
   * 실행 중인 흐름 명령 취소
   * @param {complexCmdWrapInfo|complexCmdWrapInfo[]} wrapCommand
   */
  cancelWaterFlow(wrapCommand, cancelFlowCmdType = cancelFlowCmdTypeInfo.BOTH) {
    if (_.isEmpty(wrapCommand)) return true;
    // BU.CLI('cancelFlowCommandWaterSupply');
    // BU.CLIN(wrapCommand);
    if (Array.isArray(wrapCommand) && wrapCommand.length) {
      return wrapCommand.forEach(wrapCmdInfo =>
        this.cancelWaterFlow(wrapCmdInfo, cancelFlowCmdType),
      );
    }
    // 해당 염수 이동 명령 삭제 요청
    const cloneWrapCmdInfo = _.clone(wrapCommand);
    cloneWrapCmdInfo.wrapCmdType = reqWCT.CANCEL;
    // BU.CLIN(cloneWrapCmdInfo)
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
  cancelWaterSupply(wrapCommand) {
    this.cancelWaterFlow(wrapCommand, cancelFlowCmdTypeInfo.WATER_SUPPLY);
  },

  /**
   * 실행 중인 배수 명령 취소
   * @param {complexCmdWrapInfo|complexCmdWrapInfo[]} wrapCommand
   */
  cancelDrainage(wrapCommand) {
    this.cancelWaterFlow(wrapCommand, cancelFlowCmdTypeInfo.DRAINAGE);
  },

  /**
   * 실행 중인 급수 명령 취소
   * @param {PlaceComponent} placeNode
   * @param {boolean=} 목표치 도달 체크 여부
   * @return {boolean} 진행중인 급수 명령이 있다면 true, 없다면 false
   */
  cancelWaterSupplyWithAlgorithm(placeNode, isGoalConfirm = false) {
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
      this.cancelWaterSupply(flowCmdInfo);
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
  cancelDrainageWithAlgorithm(placeNode, isGoalConfirm) {
    // 배수지 장소 Id
    const drainagePlaceId = placeNode.getPlaceId();
    // 실행 중인 염수 이동 명령 목록을 가져옴
    const currFlowCmds = coreFacade.getFlowCommandList(drainagePlaceId, null, reqWCT.CONTROL);

    // 진행 중인 배수 명령이 존재하지 않는다면 false
    if (!currFlowCmds.length) return false;

    // 배수를 진행하고 있는 명령 들 중 목표치가 없거나 달성됐다면 취소를 함
    currFlowCmds.forEach(flowCmdInfo => {
      // 목표치 확인은 있으나 아직 임계에 도달하지 못한다면 취소 명령 하지 않음
      if (isGoalConfirm && !coreFacade.isThreCmdClear(flowCmdInfo)) {
        return;
      }
      this.cancelDrainage(flowCmdInfo);
    });
    // 명령을 취소 처리할 수 있는 사항에 대해서 취소하였어도 남아있는 제어 명령이 있을경우 false
    return coreFacade.getFlowCommandList(drainagePlaceId, null, reqWCT.CONTROL).length;
  },

  /**
   * Command Execute Manager에게 실질적인 명령 요청을 하기 위한 염수 이동 명령 생성
   * @param {Object} drainageInfo 배수지 정보
   * @param {PlaceComponent} drainageInfo.placeNode 데이터 갱신이 발생한 노드
   * @param {number=} drainageInfo.goalValue 임계치 값
   * @param {number=} drainageInfo.goalRange 임계치 범위
   * @param {Object} waterSupplyInfo 급수지 정보
   * @param {PlaceComponent} waterSupplyInfo.placeNode 데이터 갱신이 발생한 노드
   * @param {number=} waterSupplyInfo.goalValue 임계치 값
   * @param {number=} waterSupplyInfo.goalRange 임계치 범위
   */
  makeWaterFlowCommand(drainageInfo = {}, waterSupplyInfo = {}) {
    // 배수지 정보
    const {
      placeNode: srcPlaceNode,
      goalValue: srcGoalValue,
      goalRange: srcGoalRange,
    } = drainageInfo;
    // 급수지 정보
    const {
      placeNode: destPlaceNode,
      goalValue: destGoalValue,
      goalRange: destGoalRange,
    } = waterSupplyInfo;

    /** @type {reqFlowCmdInfo} */
    const waterFlowCommand = {
      srcPlaceId: srcPlaceNode.getPlaceId(),
      destPlaceId: destPlaceNode.getPlaceId(),
      wrapCmdGoalInfo: {
        goalDataList: [],
      },
    };
    // 배수지 목표 임계치가 있을 경우 추가
    if (srcGoalValue) {
      waterFlowCommand.wrapCmdGoalInfo.goalDataList.push({
        nodeId: srcPlaceNode.getNodeId(),
        goalValue: srcGoalValue,
        goalRange: srcGoalRange,
      });
    }
    // 급수지 목표 임계치가 있을 경우 추가
    if (destGoalValue) {
      waterFlowCommand.wrapCmdGoalInfo.goalDataList.push({
        nodeId: destPlaceNode.getNodeId(),
        goalValue: destGoalValue,
        goalRange: destGoalRange,
      });
    }

    return waterFlowCommand;
  },

  /**
   * 임계치에 의한 자동 배수 명령
   * @param {Object} drainageInfo 배수 정보
   * @param {PlaceComponent=} drainageInfo.placeNode 데이터 갱신이 발생한 노드
   * @param {number=} drainageInfo.goalValue 임계치 값
   * @param {number=} drainageInfo.goalRange 임계치 범위
   * @param {boolean} isForce
   */
  executeAutoDrainage(drainageInfo, isForce = false) {
    const { placeNode, goalValue, goalRange } = drainageInfo;
    // 자동으로 배수를 진행할 경우 지정 장소의 수위 상한선이 존재하지 않는다면 종료
    if (!_.isNumber(placeNode.getUpperLimitValue())) return false;
    // 지정장소에서 배수를 진행할 수 있는 급수지를 찾음
    const waterSupplyPlace = this.getWaterSupplyAblePlace(placeNode);
    if (waterSupplyPlace) {
      // 염수 흐름 명령을 생성. (Src Place Id => Dest Place Id)
      coreFacade.executeFlowControl(
        this.makeWaterFlowCommand(
          {
            placeNode,
            goalValue,
            goalRange,
          },
          {
            placeNode: waterSupplyPlace,
          },
        ),
      );
    }
    // NOTE: 급수지의 염수가 가득 찼을 경우에는 강제로 이동시키지 않음.
    // else if (isForce) {
    //   const putPlaceList = placeNode.getPutPlaceRankList();
    //   // 급수지 1랭크에 염수 이동 요청
    //   if (putPlaceList.length) {
    //     const placeNodeWL = _.head(putPlaceList).getPlaceNode({ nodeDefId: ndId.WATER_LEVEL });
    //     this.executeAutoDrainage({
    //       placeNode: placeNodeWL,
    //       goalValue: placeNodeWL.getMinValue(),
    //       goalRange: goalDataRange.LOWER,
    //     });
    //   }
    // }
  },

  /**
   * 임계치에 의한 자동 급수 명령
   * @param {Object} waterSupplyInfo 배수 정보
   * @param {PlaceComponent} waterSupplyInfo.placeNode 데이터 갱신이 발생한 노드
   * @param {number=} waterSupplyInfo.goalValue 임계치 값
   * @param {number=} waterSupplyInfo.goalRange 임계치 범위
   * @param {boolean} isForce
   */
  executeAutoWaterSupply(waterSupplyInfo, isForce = false) {
    const { placeNode, goalValue, goalRange } = waterSupplyInfo;
    // 자동으로 급수를 진행할 경우 지정 장소의 수위 하한선이 존재하지 않는다면 종료
    if (!_.isNumber(placeNode.getLowerLimitValue())) return false;

    // 지정 장소에 염수를 공급할 수 있는 배수지를 찾음(수위가 충분한 배수지)
    const drainagePlace = this.getDrainageAblePlace(placeNode);
    if (drainagePlace) {
      // 염수 흐름 명령을 생성. (Src Place Id => Dest Place Id)
      coreFacade.executeFlowControl(
        this.makeWaterFlowCommand(
          {
            placeNode: drainagePlace,
          },
          {
            placeNode,
            goalValue,
            goalRange,
          },
        ),
      );
    } else if (isForce) {
      const callPlaceList = placeNode.getCallPlaceRankList();
      // 배수지 1랭크에 염수 이동 요청
      if (callPlaceList.length) {
        const placeNodeWL = _.head(callPlaceList).getPlaceNode({ nodeDefId: ndId.WATER_LEVEL });
        this.executeAutoDrainage({
          placeNode: placeNodeWL,
          goalValue: placeNodeWL.getMinValue(),
          goalRange: goalDataRange.LOWER,
        });
      }
    } else {
      throw new Error(`${placeNode.getPlaceId()} can not proceed Water Supply.`);
    }
  },

  /**
   * 지정한 장소로 배수를 진행할 수 있는 배수지 검색 (배수지 수위가 충분해야함)
   * @param {PlaceComponent} waterSupplyPlaceWL 데이터 갱신이 발생한 수위노드
   */
  getDrainageAblePlace(waterSupplyPlaceWL) {
    // BU.CLIN(waterSupplyPlaceWL);

    // 수위를 급수할 수 있는 장소 목록을 가져옴
    const callPlaceList = waterSupplyPlaceWL.getCallPlaceRankList();

    // 급수를 해올 수 있는 장소의 수위 상태
    const { MAX_OVER, UPPER_LIMIT_OVER, NORMAL } = placeNodeStatus;

    // 우선 배수지 장소 중 급수를 진행할 수 있는 장소 검색
    return _.find(callPlaceList, callPlaceStorage => {
      const nodeStatus = callPlaceStorage
        .getPlaceNode({ nodeDefId: waterSupplyPlaceWL.getNodeDefId() })
        .getNodeStatus();

      // 급수를 할 수 있는 상태는 최대 치, 상한선, 기본 일 경우 가능함
      return _.includes([MAX_OVER, UPPER_LIMIT_OVER, NORMAL], nodeStatus);
    });
  },

  /**
   * 지정한 장소로 급수를 진행 할 수 있는 배수지 검색(급수지 수위가 충분해야함)
   * @param {PlaceComponent} drainagePlaceWL 데이터 갱신이 발생한 수위노드
   */
  getWaterSupplyAblePlace(drainagePlaceWL) {
    // BU.CLIN(placeNodeWL);
    // 수위를 배수할 수 있는 장소 목록을 가져옴
    const putPlaceList = drainagePlaceWL.getPutPlaceRankList();

    // 배수를 할 수 있는 장소의 수위 상태
    const { NORMAL, LOWER_LIMIT_UNDER, MIN_UNDER } = placeNodeStatus;

    // 우선 급수지 장소 중 배수를 진행할 수 있는 장소 검색
    return _.find(putPlaceList, putPlaceStorage => {
      const nodeStatus = putPlaceStorage
        .getPlaceNode({ nodeDefId: drainagePlaceWL.getNodeDefId() })
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
    coreFacade.reloadPlaceStorage(placeId, [
      ndId.SALINITY,
      ndId.MODULE_REAR_TEMPERATURE,
      ndId.WATER_LEVEL,
    ]);
  },
};
