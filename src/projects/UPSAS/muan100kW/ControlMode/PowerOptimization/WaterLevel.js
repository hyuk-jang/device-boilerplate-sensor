const _ = require('lodash');

const { BU } = require('base-util-jh');

const { constructorInfo, dcmConfigModel } = require('../../../../../core/CoreFacade');

const { goalDataRange, reqWrapCmdType: reqWCT, placeNodeStatus } = dcmConfigModel;

const commonFn = require('../commonFn/commonFn');
const waterFlowFn = require('../commonFn/waterFlowFn');

class WaterLevel extends constructorInfo.PlaceThreshold {
  /**
   * 장치 상태가 식별 불가 일 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleUnknown(coreFacade, placeNode) {}

  /**
   * 장치 상태가 에러일 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleError(coreFacade, placeNode) {}

  /**
   * Node 임계치가 최대치를 넘을 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleMaxOver(coreFacade, placeNode) {
    try {
      BU.CLI('handleMaxOver', placeNode.getPlaceId());
      // 급수지 장소 Id
      const destPlaceId = placeNode.getPlaceId();

      // 현재 장소의 배수 명령 취소
      commonFn.cancelWaterSupply(coreFacade.getFlowCommandList(destPlaceId, null, reqWCT.CONTROL));
      // // 수위 노드에 걸려있는 임계 정보를 가져옴
      // const thresholdInfo = commonFn.getThresholdInfo(placeNode);
      // // 임계 정보에 대한 염수 이동 명령 요청
      // waterFlowFn.reqWaterFlow(placeNode, thresholdInfo);

      // 현재 장소로 급수 명령이 실행 중인지 확인
      const flowCmdList = coreFacade.cmdManager.getFlowCommandList(
        null,
        destPlaceId,
        reqWCT.CONTROL,
      );

      // // 실행 중인 급수 명령 취소 요청
      flowCmdList.length && commonFn.cancelWaterSupply(flowCmdList);

      // // 상한선 임계치에 이상이 없는지 체크
      this.handleUpperLimitOver(coreFacade, placeNode);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Node 임계치가 상한선을 넘을 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpperLimitOver(coreFacade, placeNode) {
    BU.CLI('handleUpperLimitOver', placeNode.getPlaceId());
    try {
      // 진행중인 급수 명령 취소 및 남아있는 급수 명령 존재 여부 반환
      const isProceedFlowCmd = commonFn.cancelWaterSupplyWithAlgorithm(placeNode);
      // 진행 중인 급수 명령이 있다면 상한선 처리하지 않음
      if (isProceedFlowCmd) return false;

      // 현재 장소에 배수 요청
      commonFn.executeAutoDrainage({
        placeNode,
        goalValue: placeNode.getSetValue(),
        goalRange: goalDataRange.LOWER,
      });
    } catch (error) {
      // BU.CLIN(error);
      throw error;
    }
  }

  /**
   * Node 임계치가 정상 일 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleNormal(coreFacade, placeNode) {}

  /**
   * Node 임계치가 하한선에 못 미칠 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleLowerLimitUnder(coreFacade, placeNode) {
    // BU.debugConsole();
    BU.CLI('handleLowerLimitUnder', placeNode.getPlaceId());
    try {
      // 진행중인 배수 명령 취소 및 남아있는 배수 명령 존재 여부 반환
      const isProceedFlowCmd = commonFn.cancelDrainageWithAlgorithm(placeNode, true);
      // 진행 중인 배수 명령이 있다면 하한선 처리하지 않음
      if (isProceedFlowCmd) return false;

      // 수위 노드에 걸려있는 임계 정보를 가져옴
      const thresholdInfo = commonFn.getThresholdInfo(placeNode);
      // 임계 정보에 대한 염수 이동 명령 요청
      waterFlowFn.reqWaterFlow(placeNode.getParentPlace(), thresholdInfo);

      // // 현재 장소에 급수 요청
      // commonFn.executeWaterSupply(
      //   {
      //     placeNode,
      //     goalValue: placeNode.getSetValue(),
      //     goalRange: goalDataRange.UPPER,
      //   },
      //   true,
      // );
    } catch (error) {
      // BU.CLIN(error);
      throw error;
    }
  }

  /**
   * Node 임계치가 최저치에 못 미칠 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleMinUnder(coreFacade, placeNode) {
    try {
      BU.CLI('handleMinUnder', placeNode.getPlaceId());
      // 배수지 장소 Id
      const srcPlaceId = placeNode.getPlaceId();

      // 현재 장소의 배수 명령 취소
      commonFn.cancelDrainage(coreFacade.getFlowCommandList(srcPlaceId, null, reqWCT.CONTROL));
      // 수위 노드에 걸려있는 임계 정보를 가져옴
      const thresholdInfo = commonFn.getThresholdInfo(placeNode);
      // 임계 정보에 대한 염수 이동 명령 요청
      waterFlowFn.reqWaterFlow(placeNode.getParentPlace(), thresholdInfo);
      // 하한선 임계가 있다면 명령 취소를 하였으므로 하한선 임계에 문제가 없는지 체크
      // _.isNumber(placeNode.getMinValue()) && this.handleLowerLimitUnder(coreFacade, placeNode);
    } catch (error) {
      throw error;
    }
  }
}
module.exports = WaterLevel;
