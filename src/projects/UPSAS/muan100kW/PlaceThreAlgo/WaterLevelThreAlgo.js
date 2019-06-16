const _ = require('lodash');

const { BU } = require('base-util-jh');

const PlaceThreshold = require('../../../../core/PlaceManager/PlaceThreshold');

const { dcmWsModel, dcmConfigModel } = require('../../../../../../default-intelligence');

const {
  complexCmdStep,
  nodePickKey,
  complexCmdPickKey,
  controlModeInfo,
  goalDataRange,
  nodeDataType,
  reqWrapCmdType,
  reqWrapCmdFormat,
  reqDeviceControlType,
} = dcmConfigModel;

class WaterLevelThreAlgo extends PlaceThreshold {
  /**
   * 장치 상태가 식별 불가 일 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeStorage 데이터 갱신이 발생한 장소
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUnknown(coreFacade, placeStorage, placeNode) {}

  /**
   * 장치 상태가 에러일 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeStorage 데이터 갱신이 발생한 장소
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleError(coreFacade, placeStorage, placeNode) {}

  /**
   * Node 임계치가 최대치를 넘을 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeStorage 데이터 갱신이 발생한 장소
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleMaxOver(coreFacade, placeStorage, placeNode) {
    try {
      // BU.CLIS('handleMaxOver', BU.CLI(placeStorage.getPlaceId()), placeNode.getNodeId());
      // 현재 장소로 급수 명령이 실행 중인지 확인
      const flowCmdList = coreFacade.cmdManager.getFlowCommand(null, placeStorage.getPlaceId());

      // 실행 중인 급수 명령을 취소 요청
      flowCmdList.forEach(wrapCmdInfo => {
        const cloneWrapCmdInfo = _.clone(wrapCmdInfo);
        cloneWrapCmdInfo.wrapCmdType = reqWrapCmdType.CANCEL;

        coreFacade.controller.executeFlowControl(cloneWrapCmdInfo);
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Node 임계치가 상한선을 넘을 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeStorage 데이터 갱신이 발생한 장소
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpperLimitOver(coreFacade, placeStorage, placeNode) {}

  /**
   * Node 임계치가 정상 일 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeStorage 데이터 갱신이 발생한 장소
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleNormal(coreFacade, placeStorage, placeNode) {}

  /**
   * Node 임계치가 하한선에 못 미칠 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeStorage 데이터 갱신이 발생한 장소
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleLowerLimitUnder(coreFacade, placeStorage, placeNode) {}

  /**
   * Node 임계치가 최저치에 못 미칠 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeStorage 데이터 갱신이 발생한 장소
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleMinUnder(coreFacade, placeStorage, placeNode) {
    try {
      // BU.CLIS('handleMaxOver', BU.CLI(placeStorage.getPlaceId()), placeNode.getNodeId());
      // 현재 장소에서 배수 명령이 실행 중인지 확인
      const flowCmdList = coreFacade.cmdManager.getFlowCommand(placeStorage.getPlaceId());

      // 염수가 부족하므로 실행 중인 배수 명령을 취소 요청
      flowCmdList.forEach(wrapCmdInfo => {
        const cloneWrapCmdInfo = _.clone(wrapCmdInfo);
        cloneWrapCmdInfo.wrapCmdType = reqWrapCmdType.CANCEL;

        coreFacade.controller.executeFlowControl(cloneWrapCmdInfo);
      });
    } catch (error) {
      throw error;
    }
  }
}
module.exports = WaterLevelThreAlgo;
