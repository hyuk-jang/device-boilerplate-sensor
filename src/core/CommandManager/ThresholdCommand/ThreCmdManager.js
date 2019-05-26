const _ = require('lodash');

const { BU } = require('base-util-jh');

const ThreCmdComponent = require('./ThreCmdComponent');
const ThreCmdStorage = require('./ThreCmdStorage');
const ThreCmdGoal = require('./ThreCmdGoal');

const { dcmConfigModel, dccFlagModel } = require('../../../../../default-intelligence');

const { controlModeInfo, reqWrapCmdType, reqWrapCmdFormat } = dcmConfigModel;
const { definedCommandSetRank } = dccFlagModel;

/**
 * Cmd Manager에서 임계치 정보가 있을 경우 등록 및 관리하는 역할 수행
 * 임계치 관리 총 마스터. Manager > Storage > Goal 순으로 Tree 구조를 가짐
 * 데이터가 갱신 되었을 때 Goal로 Node 정보를 보내는 역할 수행.
 */
class ThreCmdManager extends ThreCmdComponent {
  /** @param {CmdStrategy} cmdStrategy */
  constructor(cmdStrategy) {
    super();

    const { cmdManager } = cmdStrategy;

    this.cmdManager = cmdManager;

    /** @type {ThreCmdStorage[]} */
    this.threCmdStorageList = [];
  }

  // setSuccessor() {}

  /**
   * @desc Critical Component
   * 임계치 저장소를 조회하고자 할 경우
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {CriticalStorage}
   */
  getThreCmd(complexCmdWrapInfo) {
    return _.find(this.threCmdStorageList, { complexCmdWrapInfo });
  }

  /**
   * @param {ThreCmdStorage} threCmdStorage
   */
  addThreCmd(threCmdStorage) {
    this.threCmdStorageList.push(threCmdStorage);
  }

  /**
   * 임계치 목표 관리 객체를 삭제 할 경우
   * @param {ThreCmdStorage} threCmdStorage
   * @return {boolean} 삭제 성공 시 true, 아니라면 false
   */
  removeThreCmd(threCmdStorage) {
    _.pullAllWith(this.threCmdStorageList, [threCmdStorage]);
  }

  /**
   * 임계치 명령을 성공했을 경우
   * @desc Critical Component
   * @param {ThreCmdStorage} threCmdStorage
   * @return {boolean} 삭제 성공 시 true, 아니라면 false
   */
  handleThreCmdClear(threCmdStorage) {
    // BU.CLI('notifyClear');
    const {
      complexCmdWrapInfo,
      complexCmdWrapInfo: { wrapCmdId, wrapCmdFormat, srcPlaceId, destPlaceId },
    } = threCmdStorage;

    const isRemoved = this.deleteThresholdCommand(complexCmdWrapInfo);

    // 삭제를 성공하였을 경우에만 취소 명령 요청
    if (isRemoved) {
      // 흐름 명령 취소 요청
      if (wrapCmdFormat === reqWrapCmdFormat.FLOW) {
        this.cmdManager.controller.executeFlowControl({
          wrapCmdType: reqWrapCmdType.CANCEL,
          srcPlaceId,
          destPlaceId,
          rank: definedCommandSetRank.FIRST,
        });
      } else if (wrapCmdFormat === reqWrapCmdFormat.SET) {
        // 설정 명령 취소 요청
        this.cmdManager.controller.executeSetControl({
          wrapCmdType: reqWrapCmdType.CANCEL,
          wrapCmdId,
          rank: definedCommandSetRank.FIRST,
        });
      }
    }
  }

  /**
   * 임계치 명령이 추가되어 달성 목표 관리 객체를 추가 및 Node Observer 등록
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   */
  makeThresholdCommand(complexCmdWrapInfo) {
    // BU.CLI('addCriticalCommand');
    const {
      wrapCmdGoalInfo: { goalDataList, limitTimeSec },
    } = complexCmdWrapInfo;

    // 새로운 임계치 저장소 생성
    const threCmdStorage = new ThreCmdStorage(complexCmdWrapInfo);
    // 매니저를 Successor로 등록
    threCmdStorage.setSuccessor(this);
    // 설정 타이머가 존재한다면 제한 시간 타이머 동작
    if (_.isNumber(limitTimeSec)) {
      threCmdStorage.startLimiter(limitTimeSec);
    }

    // 세부 달성 목록 목표만큼 객체 생성 후 옵저버 등록
    goalDataList.forEach(goalInfo => {
      const threCmdGoal = new ThreCmdGoal(goalInfo);
      // 저장소를 Successor로 등록
      threCmdGoal.setSuccessor(threCmdStorage);

      // 노드 갱신 매니저에게 임계치 목표 객체를 옵저버로 등록
      this.cmdManager.controller.nodeUpdatorManager.attachNodeObserver(
        _.find(this.cmdManager.nodeList, { node_id: goalInfo.nodeId }),
        threCmdGoal,
      );

      // 세부 달성 목표 추가
      threCmdStorage.addThreCmd(threCmdGoal);
    });

    // 임계치 명령 저장소 추가
    this.addThreCmd(threCmdStorage);
  }

  /**
   * Threshold Command Storage에 걸려있는 임계치 타이머 삭제 및 Observer를 해제 후 삭제 처리
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   */
  deleteThresholdCommand(complexCmdWrapInfo) {
    const threCmdStorage = this.getThreCmd(complexCmdWrapInfo);

    // 타이머가 동작 중이라면 타이머 해제
    threCmdStorage.criticalLimitTimer && clearTimeout(threCmdStorage.criticalLimitTimer);

    // Update Node 정보를 받는 옵저버 해제
    threCmdStorage.children.forEach(threCmdGoal => {
      this.cmdManager.controller.nodeUpdatorManager.dettachNodeObserver(
        _.find(this.cmdManager.nodeList, { node_id: threCmdGoal.nodeId }),
        threCmdGoal,
      );
    });

    // 해당 임계치 저장소 삭제 및 true 반환
    return this.removeThreCmd(threCmdStorage);
  }
}
module.exports = ThreCmdManager;