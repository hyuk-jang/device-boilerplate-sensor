const _ = require('lodash');

const { BU } = require('base-util-jh');

const { constructorInfo, dcmConfigModel } = require('../../../../../core/CoreFacade');

const { goalDataRange, reqWrapCmdType, placeNodeStatus } = dcmConfigModel;

const commonFn = require('../commonFn');

const NODE_DEF_ID = 'waterLevel';
class WaterLevel extends constructorInfo.PlaceThreshold {
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
      // 현재 장소로 급수 명령이 실행 중인지 확인
      const flowCmdList = coreFacade.cmdManager.getFlowCommandList(null, placeNode.getPlaceId());

      // 실행 중인 급수 명령 취소 요청
      flowCmdList.length && commonFn.cancelFlowCmdWaterSupply(flowCmdList);

      // 상한선 임계치에 이상이 없는지 체크
      this.handleUpperLimitOver(coreFacade, placeNode);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Node 임계치가 상한선을 넘을 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpperLimitOver(coreFacade, placeNode) {
    // 현재 장소로 급수 명령이 실행 중인지 확인
    const flowCmdList = coreFacade.cmdManager.getFlowCommandList(null, placeNode.getPlaceId());
    // 실행 중인 급수 명령 취소 요청
    flowCmdList.length && commonFn.cancelFlowCmdWaterSupply(flowCmdList);
  }

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
    BU.CLI('handleLowerLimitUnder', placeNode.getPlaceId());
    try {
      // TODO: 현재 장소에서 배수를 진행하고 있는지 여부 검색

      // 현재 장소로 급수를 진행할 수 있는 배수지 검색 (배수지 수위가 충분해야함)
      const waterSupplyPlaceStorage = commonFn.getAbleFlowCmdWaterSupply(placeNode);

      // 배수지가 존재하지 않는다면 종료
      if (!waterSupplyPlaceStorage) return false;

      // 염수 흐름 명령을 생성.
      coreFacade.executeFlowControl(commonFn.makeAutoFlowCmd(waterSupplyPlaceStorage, placeNode));

      // 우선 순위가 높은 장소의 염수가 충분하지만 명령 충돌이 발생한다면 충돌이 해제될때까지 기다림.
      // callPlaceList.forEach(callPlaceId => {
      //   const nodeStatus = placeManager
      //     .getPlaceStorage(callPlaceId)
      //     .getPlaceNode(NODE_DEF_ID)
      //     .getNodeStatus();

      //   if (_.includes([MAX_OVER, UPPER_LIMIT_OVER, NORMAL, LOWER_LIMIT_UNDER], nodeStatus)) {
      //   }
      // });

      // 우선 순위 장소의 염수가 최저수위 이하라면 후 순위의 배수지를 찾음
    } catch (error) {
      // BU.CLIN(error);
      throw error;
    }
  }

  /**
   * Node 임계치가 최저치에 못 미칠 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleMinUnder(coreFacade, placeNode) {
    try {
      BU.CLI('handleMinUnder', placeNode.getPlaceId());

      // 현재 장소에서 배수 명령이 실행 중인지 확인
      const flowCmdList = coreFacade.cmdManager.getFlowCommandList(placeNode.getPlaceId());

      commonFn.cancelFlowCmdDrainage(flowCmdList);

      // 명령 취소를 하였으므로 하한선 임계에 문제가 없는지 체크
      this.handleLowerLimitUnder(coreFacade, placeNode);
    } catch (error) {
      throw error;
    }
  }
}
module.exports = WaterLevel;
