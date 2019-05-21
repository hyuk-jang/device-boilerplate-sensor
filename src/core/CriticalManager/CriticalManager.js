const _ = require('lodash');

const { BU } = require('base-util-jh');

const CriticalComponent = require('./CriticalComponent');
const CriticalStorage = require('./CriticalStorage');
const CriticalGoal = require('./CriticalGoal');

const { dcmConfigModel, dccFlagModel } = require('../../../../default-intelligence');

const { controlModeInfo, reqWrapCmdType, reqWrapCmdFormat } = dcmConfigModel;
const { definedCommandSetRank } = dccFlagModel;

/**
 * Cmd Manager에서 임계치 정보가 있을 경우 등록 및 관리하는 역할 수행
 * 임계치 관리 총 마스터. Manager > Storage > Goal 순으로 Tree 구조를 가짐
 * 데이터가 갱신 되었을 때 Goal로 Node 정보를 보내는 역할 수행.
 */
class CriticalManager extends CriticalComponent {
  /** @param {MainControl} controller */
  constructor(controller) {
    super();
    this.controller = controller;

    /** @type {CriticalComposite[]} */
    this.criticalStorageList = [];

    /** @type {{nodeId: string, observers: CriticalGoal[]}[]} Node List Node Id에 Critical Observers 정의 */
    this.criticalObserverList = _.map(controller.nodeList, nodeInfo => {
      const criticalObserverStorage = {
        nodeId: nodeInfo.node_id,
        observers: [],
      };
      return criticalObserverStorage;
    });
  }

  // setSuccessor() {}

  /**
   * @desc Critical Component
   * 임계치 저장소를 조회하고자 할 경우
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {CriticalStorage}
   */
  getCriticalComponent(complexCmdWrapInfo) {
    return _.find(this.criticalStorageList, { complexCmdWrapInfo });
  }

  /**
   * @desc Critical Component
   * @param {CriticalStorage} criticalStorage
   */
  addComponent(criticalStorage) {
    this.criticalStorageList.push(criticalStorage);
  }

  /**
   * @desc Critical Component
   * @param {CriticalStorage} criticalStorage
   */
  removeComponent(criticalStorage) {
    const foundIndex = _.findIndex(this.criticalStorageList, child =>
      _.isEqual(child, criticalStorage),
    );

    if (foundIndex === -1) return false;

    // 삭제 및 참 반환
    return _.pullAt(this.criticalStorageList, [foundIndex]) && true;
  }

  /**
   * 임계치 명령을 성공했을 경우
   * @desc Critical Component
   * @param {CriticalComposite} criticalStorage
   * @return {boolean} 삭제 성공 시 true, 아니라면 false
   */
  notifyClear(criticalStorage) {
    // BU.CLI('notifyClear');
    const {
      complexCmdWrapInfo,
      complexCmdWrapInfo: { wrapCmdId, wrapCmdFormat, srcPlaceId, destPlaceId },
    } = criticalStorage;

    const isRemoved = this.removeCriticalCommand(complexCmdWrapInfo);

    // 삭제를 성공하였을 경우에만 취소 명령 요청
    if (isRemoved) {
      // 흐름 명령 취소 요청
      if (wrapCmdFormat === reqWrapCmdFormat.FLOW) {
        this.controller.executeFlowControl({
          wrapCmdType: reqWrapCmdType.CANCEL,
          srcPlaceId,
          destPlaceId,
          rank: definedCommandSetRank.FIRST,
        });
      } else if (wrapCmdFormat === reqWrapCmdFormat.SET) {
        // 설정 명령 취소 요청
        this.controller.executeSetControl({
          wrapCmdType: reqWrapCmdType.CANCEL,
          wrapCmdId,
          rank: definedCommandSetRank.FIRST,
        });
      }
    }
  }

  /**
   * 임계치  저장소를 조회하고자 할 경우
   * @param {string} nodeId Node Id
   * @param {CriticalGoal} criticalGoal 세부 임계치 목표 관리 객체
   * @return {CriticalGoal}
   */
  getCriticalObserver(nodeId, criticalGoal) {
    try {
      BU.CLI('nodeId', nodeId);
      // nodeId에 맞는 임계치 옵저버 객체를 가져옴
      const criticalObserver = _.find(this.criticalObserverList, { nodeId });
      // BU.CLIN(criticalGoal);
      // BU.CLIN(criticalObserver.observers[0]);
      // BU.CLIN(criticalGoal);
      // 조회할려는 세부 임계치 목표 관리 객체를 찾아 반환
      const returnValue = _.find(criticalObserver.observers, observer =>
        _.isEqual(observer, criticalGoal),
      );
      // BU.CLIN(returnValue);
      return returnValue;
    } catch (error) {
      BU.CLI(error);
      return {};
    }
  }

  /**
   * Node의 데이터가 갱신되었고 임계치 옵저버가 존재할 경우 전파
   * @param {nodeInfo[]} nodeList Renewal Node List
   */
  updateNodeList(nodeList) {
    nodeList.forEach(nodeInfo => {
      // 크리티컬 옵저버 저장소를 가져옴
      const criticalObserverStorage = _.find(this.criticalObserverList, {
        nodeId: nodeInfo.node_id,
      });
      // 옵저버에게 갱신된 노드를 전파
      criticalObserverStorage.observers.forEach(observer => {
        observer.notifyNodeInfo(nodeInfo);
      });
    });
  }

  /**
   * 임계치 명령이 추가되어 달성 목표 관리 객체를 추가하고자 할 경우
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   */
  addCriticalCommand(complexCmdWrapInfo) {
    // BU.CLI('addCriticalCommand');
    const {
      wrapCmdGoalInfo: { goalDataList, limitTimeSec },
    } = complexCmdWrapInfo;

    // 새로운 임계치 저장소 생성
    const criticalStorage = new CriticalStorage(complexCmdWrapInfo);
    // 매니저를 Successor로 등록
    criticalStorage.setSuccessor(this);
    // 설정 타이머가 존재한다면 제한 시간 타이머 동작
    if (_.isNumber(limitTimeSec)) {
      criticalStorage.startLimiter(limitTimeSec);
    }

    // 세부 달성 목록 목표만큼 객체 생성 후 옵저버 등록
    goalDataList.forEach(goalInfo => {
      const criticalGoal = new CriticalGoal(goalInfo);
      // 저장소를 Successor로 등록
      criticalGoal.setSuccessor(criticalStorage);
      // Update Node 정보를 받을 옵저버 등록
      this.attachObserver(criticalGoal);
      // 세부 달성 목표 추가
      criticalStorage.addComponent(criticalGoal);
    });

    this.criticalStorageList.push(criticalStorage);
  }

  /**
   * Critical Storage에 걸려있는 임계치 타이머 삭제 및 Observer를 해제 후 삭제 처리
   * @param {CriticalStorage} criticalStorage
   */
  removeCriticalStorage(criticalStorage) {
    // 타이머가 동작 중이라면 타이머 해제
    criticalStorage.criticalLimitTimer && clearTimeout(criticalStorage.criticalLimitTimer);

    // Update Node 정보를 받는 옵저버 해제
    criticalStorage.children.forEach(criticalGoal => {
      this.dettachObserver(criticalGoal);
    });

    // 해당 임계치 저장소 삭제 및 true 반환
    return this.removeComponent(criticalStorage);
  }

  /**
   * 임계치 목표 관리 객체를 삭제 할 경우
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {boolean} 삭제 성공 시 true, 아니라면 false
   */
  removeCriticalCommand(complexCmdWrapInfo) {
    const criticalStorage = this.getCriticalComponent(complexCmdWrapInfo);
    // 해당 Critical Storage를 찾지 못하였다면 삭제 실패
    if (_.isEmpty(criticalStorage)) return false;

    return this.removeCriticalStorage(criticalStorage);
  }

  /**
   * 데이터가 갱신될 때 데이터를 수신할 임계치 옵저버 추가 메소드
   * @param {CriticalGoal} criticalGoal
   * @return {void} 추가 실패시 예외 발생
   */
  attachObserver(criticalGoal) {
    const { nodeId } = criticalGoal;
    const criticalObserverStorage = _.find(this.criticalObserverList, { nodeId });

    if (criticalObserverStorage) {
      const { observers } = criticalObserverStorage;

      if (_.find(observers, observer => _.isEqual(observer, criticalGoal))) {
        throw new Error('The Critical Goal already exists.');
      }

      // 임계치 관리자 형태를 가질 경우에만 추가
      if (criticalGoal instanceof CriticalGoal) {
        observers.push(criticalGoal);
      } else {
        throw new Error('this Critical Goal is not Critical Goal.');
      }
    } else {
      throw new Error('The Critical Goal does not exist.');
    }
  }

  /**
   * 데이터가 갱신될 때 데이터를 수신할 임계치 옵저버 제거 메소드
   * @param {CriticalGoal} criticalGoal
   * @return {void} 삭제 실패 시 예외 발생
   */
  dettachObserver(criticalGoal) {
    // BU.CLIN(criticalGoal);
    const { nodeId } = criticalGoal;

    // BU.CLIN(this.criticalObserverList);

    const criticalObserverStorage = _.find(this.criticalObserverList, { nodeId });

    if (criticalObserverStorage) {
      const { observers } = criticalObserverStorage;

      // 해당 크리티컬 매니저가 존재하는 Index를 가져옴
      const foundIndex = _.findIndex(observers, observer => _.isEqual(observer, criticalGoal));

      if (foundIndex === -1) {
        throw new Error('The Critical Goal does not exist.');
      }
      // 존재한다면 삭제
      return _.pullAt(observers, [foundIndex]);
    }
    throw new Error(`nodeId: ${nodeId} is not exist.`);
  }
}
module.exports = CriticalManager;
