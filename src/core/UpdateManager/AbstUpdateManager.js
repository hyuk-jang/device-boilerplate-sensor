const _ = require('lodash');

const { BU } = require('base-util-jh');

const CriticalManager = require('./CriticalManager');
const AbstCriticalManager = require('../CriticalManager/AbstCriticalManager');

class AbstUpdateManager {
  /** @param {MainControl} controller */
  constructor(controller) {
    this.controller = controller;

    const { model, nodeList } = this.controller;
    const { complexCmdList, overlapControlStorageList, mapCmdInfo } = model;

    this.nodeList = nodeList;

    this.model = model;

    this.complexCmdList = complexCmdList;
    this.overlapControlStorageList = overlapControlStorageList;

    this.mapCmdInfo = mapCmdInfo;

    /** @type {{nodeId: string, observers: AbstCriticalManager[]}[]} */
    this.criticalObserverStorageList = [];
  }

  /**
   * 기존 Node List에 Critical 정보를 바인딩
   */
  init() {
    this.nodeList.forEach(nodeInfo => {
      /** @type {{nodeId: string, observers: AbstCriticalManager[]}} */
      const criticalObserverStorage = {
        nodeId: nodeInfo.node_id,
        observers: [],
      };

      this.criticalObserverStorageList.push(criticalObserverStorage);

      _.set(nodeInfo, 'ciriticalObservers', observer => {
        if (observer instanceof AbstCriticalManager) {
          observer.updateNodeInfo(nodeInfo);
        }
      });
    });
  }

  /**
   *
   * @param {nodeInfo[]} nodeList Renewal Node List
   */
  updateNodeList(nodeList) {
    nodeList.forEach(nodeInfo => {
      // 크리티컬 옵저버 저장소를 가져옴
      const criticalObserverStorage = _.find(this.criticalObserverStorageList, {
        nodeId: nodeInfo.node_id,
      });
      // 옵저버에게 갱신된 노드를 전파
      criticalObserverStorage.observers.forEach(observer => {
        observer.updateNodeInfo(nodeInfo);
      });
    });
  }

  /**
   *
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   */
  addCriticalStorage(complexCmdWrapInfo) {}

  /**
   * 데이터가 갱신될 때 데이터를 수신할 임계치 옵저버 추가 메소드
   * @param {string} nodeId
   * @param {AbstCriticalManager} ciriticalManager
   */
  attachObserver(nodeId, ciriticalManager) {
    const criticalObserverStorage = _.find(this.criticalObserverStorageList, { nodeId });

    if (criticalObserverStorage) {
      const { observers } = criticalObserverStorage;

      if (_.find(observers, observer => _.isEqual(observer, ciriticalManager))) {
        throw new Error('The Critical Manager already exists.');
      }

      // 임계치 관리자 형태를 가질 경우에만 추가
      if (ciriticalManager instanceof AbstCriticalManager) {
        observers.push(ciriticalManager);
      } else {
        throw new Error('this Critical Manager is not Critical Manager.');
      }
    } else {
      throw new Error('The Critical Manager does not exist.');
    }
  }

  /**
   * 데이터가 갱신될 때 데이터를 수신할 임계치 옵저버 추가 메소드
   * @param {string} nodeId
   * @param {AbstCriticalManager} ciriticalManager
   * @return {boolean} 삭제 할 경우 true, 삭제 실패 시 false
   */
  dettachObserver(nodeId, ciriticalManager) {
    const criticalObserverStorage = _.find(this.criticalObserverStorageList, { nodeId });

    if (criticalObserverStorage) {
      const { observers } = criticalObserverStorage;

      // 해당 크리티컬 매니저가 존재하는 Index를 가져옴
      const foundIndex = _.findIndex(observers, observer => _.isEqual(observer, ciriticalManager));

      // 존재하지 않을 경우 false
      if (foundIndex !== -1) {
        return false;
      }
      // 존재한다면 삭제하고 true 반환
      _.pullAt(observers, [foundIndex]);
      return true;

      // _.remove(observers, observer => _.isEqual(observer, ciriticalManager));
    }
  }
}
module.exports = AbstUpdateManager;
