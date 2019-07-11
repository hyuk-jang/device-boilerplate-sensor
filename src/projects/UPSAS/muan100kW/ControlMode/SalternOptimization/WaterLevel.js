const _ = require('lodash');

const { BU } = require('base-util-jh');

const {
  constructorInfo: { PlaceThreshold },
  dcmConfigModel,
} = require('../../../../../core/CoreFacade');

const { goalDataRange, reqWrapCmdType, placeNodeStatus } = dcmConfigModel;

class WaterLevel extends PlaceThreshold {
  /**
   * 장치 상태가 식별 불가 일 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUnknown(coreFacade, placeNode) {}

  /**
   * 장치 상태가 에러일 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleError(coreFacade, placeNode) {}

  /**
   * Node 임계치가 최대치를 넘을 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleMaxOver(coreFacade, placeNode) {
    try {
      // BU.CLI('handleMaxOver', placeNode.getPlaceId());
      // BU.CLIS('handleMaxOver', BU.CLI(placeStorage.getPlaceId()), placeNode.getNodeId());
      // 현재 장소로 급수 명령이 실행 중인지 확인
      const flowCmdList = coreFacade.cmdManager.getFlowCommandList(null, placeNode.getPlaceId());

      // 실행 중인 급수 명령을 취소 요청
      flowCmdList.forEach(wrapCmdInfo => {
        const cloneWrapCmdInfo = _.clone(wrapCmdInfo);
        cloneWrapCmdInfo.wrapCmdType = reqWrapCmdType.CANCEL;
        // 급수 명령 취소 요청
        coreFacade.executeFlowControl(cloneWrapCmdInfo);
        // 명령 취소를 하였으므로 하한선 임계에 문제가 없는지 체크
        coreFacade.reloadPlaceStorage(cloneWrapCmdInfo.srcPlaceId);
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Node 임계치가 상한선을 넘을 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpperLimitOver(coreFacade, placeNode) {}

  /**
   * Node 임계치가 정상 일 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleNormal(coreFacade, placeNode) {}

  /**
   * Node 임계치가 하한선에 못 미칠 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleLowerLimitUnder(coreFacade, placeNode) {
    // BU.CLI('handleLowerLimitUnder', placeNode.getPlaceId());
  }

  /**
   * Node 임계치가 최저치에 못 미칠 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleMinUnder(coreFacade, placeNode) {
    try {
      // BU.CLI('handleMinUnder', placeNode.getPlaceId());

      // 현재 장소에서 배수 명령이 실행 중인지 확인
      const flowCmdList = coreFacade.cmdManager.getFlowCommandList(placeNode.getPlaceId());

      // 염수가 부족하므로 실행 중인 배수 명령을 취소 요청
      flowCmdList.forEach(wrapCmdInfo => {
        const cloneWrapCmdInfo = _.clone(wrapCmdInfo);
        cloneWrapCmdInfo.wrapCmdType = reqWrapCmdType.CANCEL;
        // 배수 명령 취소 요청
        coreFacade.executeFlowControl(cloneWrapCmdInfo);
        // 배수 명령을 취소하였으면 배수지 데이터 갱신 이벤트 발생 요청
        coreFacade.reloadPlaceStorage(cloneWrapCmdInfo.destPlaceId);
      });
      // 명령 취소를 하였으므로 하한선 임계에 문제가 없는지 체크
      this.handleLowerLimitUnder(coreFacade, placeNode);
    } catch (error) {
      throw error;
    }
  }
}
module.exports = WaterLevel;
