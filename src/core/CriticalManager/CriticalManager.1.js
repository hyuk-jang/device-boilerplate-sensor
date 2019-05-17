const _ = require('lodash');

const { BU } = require('base-util-jh');

const CriticalStorage = require('./CriticalStorage');
const CriticalGoal = require('./CriticalGoal');

const { dcmConfigModel, dccFlagModel } = require('../../../../default-intelligence');

const { controlModeInfo, reqWrapCmdType, reqWrapCmdFormat } = dcmConfigModel;
const { definedCommandSetRank } = dccFlagModel;

class CriticalManager {
  /** @param {MainControl} controller */
  constructor(controller) {
    this.controller = controller;

    /** @type {CriticalStorage[]} */
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

  /**
   * 임계치 저장소를 조회하고자 할 경우
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   */
  getCriticalStorage(complexCmdWrapInfo) {
    return _.find(this.criticalStorageList, { complexCmdWrapInfo });
  }

  /**
   * 임계치  저장소를 조회하고자 할 경우
   * @param {string} nodeId Node Id
   * @param {CriticalGoal} criticalGoal 세부 임계치 목표 관리 객체
   * @return {CriticalGoal}
   */
  getCriticalObserver(nodeId, criticalGoal) {
    try {
      // nodeId에 맞는 임계치 옵저버 객체를 가져옴
      const criticalObserver = _.find(this.criticalObserverList, { nodeId });
      BU.CLIN(criticalObserver.observers[0]);
      BU.CLIN(criticalGoal);
      // 조회할려는 세부 임계치 목표 관리 객체를 찾아 반환
      const returnValue = _.find(criticalObserver.observers, observer =>
        _.isEqual(observer, criticalGoal),
      );
      BU.CLIN(returnValue);
      return returnValue;
    } catch (error) {
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
   * 임계치 명령을 추가하고자 할 경우
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   */
  addCriticalStorage(complexCmdWrapInfo) {
    const foundIndex = _.findIndex(this.criticalStorageList, { complexCmdWrapInfo });
    // 해당 Critical Storage가 존재한다면 추가 실패
    if (foundIndex !== -1) return false;
    // 추가 후 true 반환
    const criticalStorage = new CriticalStorage(this, complexCmdWrapInfo);
    criticalStorage.init();

    this.criticalStorageList.push(criticalStorage);

    // Update Node 정보를 받을 옵저버 등록
    criticalStorage.criticalGoalList.forEach(criticalGoal => {
      this.attachObserver(criticalGoal);
    });
  }

  /**
   * 임계치 명령을 삭제 할 경우
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {boolean} 삭제 성공 시 true, 아니라면 false
   */
  removeCriticalStorage(complexCmdWrapInfo) {
    const foundIndex = _.findIndex(this.criticalStorageList, { complexCmdWrapInfo });
    // 해당 Critical Storage를 찾지 못하였다면 삭제 실패
    if (foundIndex === -1) return false;

    const criticalStorage = this.criticalStorageList[foundIndex];

    // 타이머가 동작 중이라면 타이머 해제
    criticalStorage.criticalLimitTimer && clearTimeout(criticalStorage.criticalLimitTimer);

    // Update Node 정보를 받는 옵저버 해제
    criticalStorage.criticalGoalList.forEach(criticalGoal => {
      this.dettachObserver(criticalGoal);
    });

    // 해당 임계치 저장소 삭제 및 true 반환
    return _.pullAt(this.criticalStorageList, [foundIndex]) && true;
  }

  /**
   * 임계치 명령을 성공하고 취소 명령을 발송할 경우
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {boolean} 삭제 성공 시 true, 아니라면 false
   */
  achieveGoal(complexCmdWrapInfo) {
    const { wrapCmdId, wrapCmdFormat, srcPlaceId, destPlaceId } = complexCmdWrapInfo;

    const isRemoved = this.removeCriticalStorage(complexCmdWrapInfo);

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
    const { nodeId } = criticalGoal;

    const criticalObserverStorage = _.find(this.criticalObserverList, { nodeId });

    if (criticalObserverStorage) {
      const { observers } = criticalObserverStorage;

      // 해당 크리티컬 매니저가 존재하는 Index를 가져옴
      const foundIndex = _.findIndex(observers, observer => _.isEqual(observer, criticalGoal));

      if (foundIndex !== -1) {
        throw new Error('The Critical Goal does not exist.');
      }
      // 존재한다면 삭제
      return _.pullAt(observers, [foundIndex]);
    }
    throw new Error(`nodeId: ${nodeId} is not exist.`);
  }
}
module.exports = CriticalManager;
