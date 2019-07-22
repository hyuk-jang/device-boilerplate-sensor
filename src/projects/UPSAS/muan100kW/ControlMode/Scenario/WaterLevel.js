const _ = require('lodash');

const { BU } = require('base-util-jh');

const {
  constructorInfo: { PlaceThreshold },
  dcmConfigModel,
} = require('../../../../../core/CoreFacade');

const { goalDataRange, reqWrapCmdType: reqWCT, placeNodeStatus } = dcmConfigModel;

const commonFn = require('../commonFn/commonFn');
const waterFlowFn = require('../commonFn/waterFlowFn');

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
      commonFn.cancelWaterSupply(coreFacade.getFlowCommandList(null, destPlaceId, reqWCT.CONTROL));
      // 수위 노드에 걸려있는 임계 정보를 가져옴
      const thresholdInfo = commonFn.getThresholdInfo(placeNode);
      // 임계 정보에 대한 염수 이동 명령 요청
      waterFlowFn.reqWaterFlow(placeNode, thresholdInfo, placeNodeStatus.NORMAL);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Node 임계치가 상한선을 넘을 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpperLimitOver(coreFacade, placeNode) {}

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
  handleLowerLimitUnder(coreFacade, placeNode) {}

  /**
   * Node 임계치가 최저치에 못 미칠 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleMinUnder(coreFacade, placeNode) {}
}
module.exports = WaterLevel;
