const _ = require('lodash');

const { BU } = require('base-util-jh');

const AbstAlgorithm = require('./AbstAlgorithm');

const CoreFacade = require('../../../../core/CoreFacade');

const {
  dcmConfigModel: { reqWrapCmdType, placeNodeStatus, goalDataRange },
} = CoreFacade;

const coreFacade = new CoreFacade();

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
    cloneWrapCmdInfo.wrapCmdType = reqWrapCmdType.CANCEL;
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
  },

  /**
   * 실행 중인 배수 명령 취소
   * @param {complexCmdWrapInfo|complexCmdWrapInfo[]} wrapCommand
   */
  cancelFlowCmdDrainage(wrapCommand) {
    // BU.CLIN(wrapCommand);
    this.cancelFlowCmd(wrapCommand, cancelFlowCmdTypeInfo.DRAINAGE);
  },

  /**
   * 두 장소사이에서 자동프로세스를 통한 자동 염수 이동 명령 생성
   * @param {PlaceComponent} srcPlace 데이터 갱신이 발생한 노드
   * @param {PlaceComponent} destPlace 데이터 갱신이 발생한 노드
   */
  makeAutoFlowCmd(srcPlace, destPlace) {
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
