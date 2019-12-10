const _ = require('lodash');

const { BU } = require('base-util-jh');

const {
  constructorInfo: { PlaceThreshold },
  dcmConfigModel,
} = require('../../../../../core/CoreFacade');

const { goalDataRange: goalDR, reqWrapCmdType: reqWCT, placeNodeStatus: pNS } = dcmConfigModel;

const commonFn = require('../algorithm/commonFn');
const waterFlowFn = require('../algorithm/waterFlowFn');

class WaterLevel extends PlaceThreshold {
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
      // BU.CLI('handleMaxOver', placeNode.getPlaceId());
      // 급수지 장소 Id
      const destPlaceId = placeNode.getPlaceId();

      // 현재 장소의 배수 명령 취소
      const cmdStorageList = coreFacade.cmdManager.getCmdStorageList({
        destPlaceId,
        wrapCmdType: reqWCT.CONTROL,
      });
      // BU.CLIN(cmdList);
      commonFn.cancelWaterSupply(cmdStorageList);

      // 남아있는 명령 저장소
      const existCmdStorageList = coreFacade.cmdManager.getCmdStorageList({
        destPlaceId,
      });

      // 진행 중인 급수 명령이 있다면 상한선 처리하지 않음
      if (existCmdStorageList.length) return false;

      // 수위 노드에 걸려있는 임계 정보를 가져옴
      const thresholdInfo = commonFn.getThresholdInfo(placeNode);
      // 임계 정보에 대한 염수 이동 명령 요청
      waterFlowFn.reqWaterFlow(placeNode, thresholdInfo, pNS.NORMAL);
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
      // 급수지 장소 Id
      const destPlaceId = placeNode.getPlaceId();

      // 진행중인 급수 명령 취소 및 남아있는 급수 명령 존재 여부 반환
      commonFn.cancelWaterSupplyWithAlgorithm(placeNode, true);

      // 남아있는 명령 저장소
      const existCmdStorageList = coreFacade.cmdManager.getCmdStorageList({
        destPlaceId,
      });

      // 진행 중인 급수 명령이 있다면 상한선 처리하지 않음
      if (existCmdStorageList.length) return false;

      // BU.CLI('복원을 해야지?');
      // 수위 노드에 걸려있는 임계 정보를 가져옴
      const thresholdInfo = commonFn.getThresholdInfo(placeNode);
      // BU.CLIN(thresholdInfo);
      // 임계 정보에 대한 염수 이동 명령 요청
      waterFlowFn.reqWaterFlow(placeNode.getParentPlace(), thresholdInfo, pNS.NORMAL);
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
    BU.CLI('handleLowerLimitUnder', placeNode.getPlaceId());
    try {
      // 진행중인 배수 명령 취소 및 남아있는 배수 명령 존재 여부 반환
      // 배수지 장소 Id
      const srcPlaceId = placeNode.getPlaceId();

      commonFn.cancelDrainageWithAlgorithm(placeNode, true);

      const existCmdStorageList = coreFacade.cmdManager.getCmdStorageList({
        srcPlaceId,
      });

      // 진행 중인 배수 명령이 있다면 하한선 처리하지 않음
      if (existCmdStorageList.length) return false;

      // 수위 노드에 걸려있는 임계 정보를 가져옴
      const thresholdInfo = commonFn.getThresholdInfo(placeNode);
      // 임계 정보에 대한 염수 이동 명령 요청
      // BU.CLI('waterFlowFn.reqWaterFlow');
      waterFlowFn.reqWaterFlow(placeNode.getParentPlace(), thresholdInfo, pNS.NORMAL);
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
      // BU.CLI('handleMinUnder', placeNode.getPlaceId());
      // 배수지 장소 Id
      const srcPlaceId = placeNode.getPlaceId();

      const cmdStorageList = coreFacade.cmdManager.getCmdStorageList({
        srcPlaceId,
        wrapCmdType: reqWCT.CONTROL,
      });

      // 현재 장소의 배수 명령 취소
      commonFn.cancelDrainage(cmdStorageList);

      const existCmdStorageList = coreFacade.cmdManager.getCmdStorageList({
        srcPlaceId,
      });

      // 진행 중인 배수 명령이 있다면 하한선 처리하지 않음
      if (existCmdStorageList.length) return false;

      // 수위 노드에 걸려있는 임계 정보를 가져옴
      const thresholdInfo = commonFn.getThresholdInfo(placeNode);

      // BU.CLI(thresholdInfo);
      // 임계 정보에 대한 염수 이동 명령 요청
      waterFlowFn.reqWaterFlow(placeNode.getParentPlace(), thresholdInfo, pNS.NORMAL);
    } catch (error) {
      throw error;
    }
  }
}
module.exports = WaterLevel;
