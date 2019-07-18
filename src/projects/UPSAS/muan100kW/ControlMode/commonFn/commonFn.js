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
   *
   * @param {PlaceNode} placeNode
   */
  getThresholdInfo(placeNode) {
    /** @type {mThresholdInfo} */
    let thresholdInfo = {};
    switch (placeNode.getNodeStatus()) {
      case placeNodeStatus.MAX_OVER:
        thresholdInfo = placeNode.maxValue;
        break;
      case placeNodeStatus.UPPER_LIMIT_OVER:
        thresholdInfo = placeNode.upperLimitValue;
        break;
      case placeNodeStatus.NORMAL:
        thresholdInfo = placeNode.setValue;
        break;
      case placeNodeStatus.LOWER_LIMIT_UNDER:
        thresholdInfo = placeNode.lowerLimitValue;
        break;
      case placeNodeStatus.MIN_UNDER:
        thresholdInfo = placeNode.minValue;
        break;
      case placeNodeStatus.UNKNOWN:
      case placeNodeStatus.ERROR:
        thresholdInfo = {};
        break;
      default:
        thresholdInfo = {};
        break;
    }
    return thresholdInfo;
  },

  /**
   * 장소에 노드에 걸려있는 임계치를 가져옴
   * @param {PlaceStorage} placeStorage
   * @param {string} nodeDefId
   * @param {string=} placeNodeThreshold
   */
  getPlaceThresholdValue(placeStorage, nodeDefId, placeNodeThreshold) {
    let thresholdValue;
    switch (placeNodeThreshold) {
      case placeNodeStatus.MAX_OVER:
        thresholdValue = placeStorage.getMaxValue(nodeDefId);
        break;
      case placeNodeStatus.UPPER_LIMIT_OVER:
        thresholdValue = placeStorage.getUpperLimitValue(nodeDefId);
        break;
      case placeNodeStatus.MIN_UNDER:
        thresholdValue = placeStorage.getMinValue(nodeDefId);
        break;
      case placeNodeStatus.LOWER_LIMIT_UNDER:
        thresholdValue = placeStorage.getLowerLimitValue(nodeDefId);
        break;
      case placeNodeStatus.NORMAL:
        thresholdValue = placeStorage.getSetValue(nodeDefId);
        break;
      default:
        break;
    }

    return thresholdValue;
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
