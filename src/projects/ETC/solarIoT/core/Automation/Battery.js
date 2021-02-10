const _ = require('lodash');

const { BU } = require('base-util-jh');

const commonFn = require('../algorithm/commonFn');

const { cmdStep, ndId, gDR, pNS, reqWCF, reqWCT, reqDCT } = commonFn;

const ConcretePlaceThreshold = require('../ConcretePlaceThreshold');

module.exports = class extends ConcretePlaceThreshold {
  /**
   * 장치 상태가 식별 불가 일 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleUnknown(placeNode) {}

  /**
   * 장치 상태가 에러일 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleError(placeNode) {}

  /**
   * Node 임계치가 최대치를 넘을 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleMaxOver(placeNode) {}

  /**
   * Node 임계치가 상한선을 넘을 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpperLimitOver(placeNode) {
    // BU.log('handleUpperLimitOver', placeNode.getPlaceId());

    // 장소에 걸려있는 릴레이 장치를 가져옴
    const {
      nodeInfo: { data },
      nodeId,
      ncId,
    } = placeNode.getParentPlace().getPlaceNode(commonFn.ndId.RELAY);

    // 실행 중인 False 명령 해제
    this.coreFacade.cmdManager.commandList.forEach(cmdStorage => {
      const cmdEleList = cmdStorage.getCmdEleList({
        nodeId,
        singleControlType: reqDCT.FALSE,
      });
      // 명령 취소
      if (cmdEleList.length) {
        cmdStorage.cancelCommand();
      }
    });

    // 이미 실행 명령 요청 중일 경우
    // FIXME: 이미 실행 중인데 상태값이 안맞을 경우 처리 로직 필요
    const existCmdStorageList = this.coreFacade.cmdManager.commandList.filter(
      cmdStorage =>
        cmdStorage.getCmdEleList({
          nodeId,
          singleControlType: reqDCT.TRUE,
        }).length,
    );

    // 진행 중인 명령이 있다면 처리하지 않음
    if (existCmdStorageList.length) return false;

    const { enName } = this.coreFacade.controller.mdControlIdenStorage
      .get(ncId)
      .get(reqDCT.TRUE);

    // 현재 상태와 동일하다면 처리하지 않음
    if (data === enName) return false;

    // 해당 장치가 동작 중이지 않으면 제어 명령 요청
    this.coreFacade.executeSingleControl({
      nodeId,
      wrapCmdType: reqWCT.CONTROL,
      singleControlType: reqDCT.TRUE,
    });
  }

  /**
   * Node 임계치가 정상 일 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleNormal(placeNode) {}

  /**
   * Node 임계치가 하한선에 못 미칠 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleLowerLimitUnder(placeNode) {
    // BU.log('handleLowerLimitUnder', placeNode.getPlaceId());
    const {
      nodeInfo: { data },
      nodeId,
      ncId,
    } = placeNode.getParentPlace().getPlaceNode(commonFn.ndId.RELAY);

    // 실행 중인 True 명령 해제
    this.coreFacade.cmdManager.commandList.forEach(cmdStorage => {
      const cmdEleList = cmdStorage.getCmdEleList({
        nodeId,
        singleControlType: reqDCT.TRUE,
      });
      // 명령 취소
      if (cmdEleList.length) {
        cmdStorage.cancelCommand();
      }
    });

    // 이미 실행 명령 요청 중일 경우
    // FIXME: 이미 실행 중인데 상태값이 안맞을 경우 처리 로직 필요
    const existCmdStorageList = this.coreFacade.cmdManager.commandList.filter(
      cmdStorage =>
        cmdStorage.getCmdEleList({
          nodeId,
          singleControlType: reqDCT.FALSE,
        }).length,
    );

    // 진행 중인 명령이 있다면 처리하지 않음
    if (existCmdStorageList.length) return false;

    const { enName } = this.coreFacade.controller.mdControlIdenStorage
      .get(ncId)
      .get(reqDCT.FALSE);

    // 현재 상태와 동일하다면 처리하지 않음
    if (data === enName) return false;

    // 해당 장치가 동작 중이지 않으면 제어 명령 요청
    this.coreFacade.executeSingleControl({
      nodeId,
      wrapCmdType: reqWCT.CONTROL,
      singleControlType: reqDCT.FALSE,
    });
  }

  /**
   * Node 임계치가 최저치에 못 미칠 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleMinUnder(placeNode) {}
};
