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
  placeNodeStatus,
  reqWrapCmdFormat,
  reqDeviceControlType,
} = dcmConfigModel;

const NODE_DEF_ID = 'waterLevel';
class WaterLevelThreAlgo extends PlaceThreshold {
  constructor() {
    super();

    BU.CLIN(this);
  }

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
      // BU.CLIS('handleMaxOver', BU.CLI(placeStorage.getPlaceId()), placeNode.getNodeId());
      // 현재 장소로 급수 명령이 실행 중인지 확인
      const flowCmdList = coreFacade.cmdManager.getFlowCommand(null, placeNode.getPlaceId());

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
    BU.CLI('handleLowerLimitUnder', placeNode.getPlaceId());
    try {
      // 하한선 수위가 존재하지 않는다면 종료
      if (!_.isNumber(placeNode.getLowerLimitValue())) return false;

      // 수위 하한선에 걸렸기 때문에 수위를 급수할 수 있는 장소 목록을 가져옴
      const callPlaceList = placeNode.getCallPlaceRankList();

      // BU.CLIN(callPlaceList, 1);

      // 급수를 해올 수 있는 장소의 수위 상태
      const { MAX_OVER, UPPER_LIMIT_OVER, NORMAL, LOWER_LIMIT_UNDER } = placeNodeStatus;

      BU.CLI(MAX_OVER, UPPER_LIMIT_OVER, NORMAL, LOWER_LIMIT_UNDER);
      // 우선 배수지 장소 중 급수를 진행할 수 있는 장소 검색
      const ablePlaceStorage = _.find(callPlaceList, callPlaceStorage => {
        const nodeStatus = callPlaceStorage
          .getPlaceNode({ nodeDefId: NODE_DEF_ID })
          .getNodeStatus();

        const node = callPlaceStorage.getPlaceNode({ nodeDefId: NODE_DEF_ID });

        // BU.CLI(callPlaceStorage.getPlaceId(), nodeStatus);
        // BU.CLI(node.getLowerLimitValue());
        // BU.CLI(callPlaceStorage.getPlaceNode({ nodeDefId: NODE_DEF_ID }).nodeInfo.data);

        // 급수를 할 수 있는 상태는 최대 치, 상한선, 기본, 하한선 일 경우 가능함
        return _.includes([MAX_OVER, UPPER_LIMIT_OVER, NORMAL, LOWER_LIMIT_UNDER], nodeStatus);
      });

      BU.CLI(ablePlaceStorage.getPlaceNode({ nodeDefId: NODE_DEF_ID }).getNodeStatus());

      // 배수지가 존재하지 않는다면 종료
      if (!ablePlaceStorage) return false;

      BU.CLIN(coreFacade.cmdManager.complexCmdList);

      // BU.CLIN(ablePlaceStorage, 1);
      BU.CLIN(ablePlaceStorage.getPlaceId());
      BU.CLI(
        ablePlaceStorage
          .getPlaceNode({
            nodeDefId: NODE_DEF_ID,
          })
          .getValue(),
      );

      // 염수 흐름 명령을 생성.
      coreFacade.cmdExecManager.executeFlowControl({
        srcPlaceId: ablePlaceStorage.getPlaceId(),
        destPlaceId: placeNode.getPlaceId(),
        wrapCmdGoalInfo: {
          goalDataList: [
            _.isNumber(placeNode.getSetValue())
              ? {
                  nodeId: placeNode.getNodeId(),
                  goalValue: placeNode.getSetValue(),
                  goalRange: goalDataRange.UPPER,
                }
              : {},
          ],
        },
      });

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
      const flowCmdList = coreFacade.cmdManager.getFlowCommand(placeNode.getPlaceId());

      // 염수가 부족하므로 실행 중인 배수 명령을 취소 요청
      flowCmdList.forEach(wrapCmdInfo => {
        const cloneWrapCmdInfo = _.clone(wrapCmdInfo);
        cloneWrapCmdInfo.wrapCmdType = reqWrapCmdType.CANCEL;

        coreFacade.controller.executeFlowControl(cloneWrapCmdInfo);
      });
      // 명령 취소를 하였으므로 하한선 임계에 문제가 없는지 체크
      this.handleLowerLimitUnder(coreFacade, placeNode);
    } catch (error) {
      throw error;
    }
  }
}
module.exports = WaterLevelThreAlgo;
