const _ = require('lodash');

const NodeUpdator = require('./NodeUpdator');

const {
  dcmConfigModel: { controlModeInfo },
} = require('../../../../../default-intelligence');

class NodeUpdatorManager {
  /** @param {NodeUpdator[]} nodeList */
  constructor(nodeList) {
    this.nodeUpdatorList = nodeList.map(nodeInfo => {
      return new NodeUpdator(nodeInfo);
    });
  }

  /**
   * 노드 정보를 가진 Node Updator 조회
   * @param {nodeInfo} nodeInfo
   */
  getNodeUpdator(nodeInfo) {
    return _.find(this.nodeUpdatorList, nodeUpdator => _.isEqual(nodeUpdator.nodeInfo, nodeInfo));
  }

  /**
   * @param {nodeInfo} nodeInfo 노드 객체 정보
   * @param {Observer} observer 옵저버 추가
   * */
  attachNodeObserver(nodeInfo, observer) {
    const foundNodeUpdator = this.getNodeUpdator(nodeInfo);

    if (foundNodeUpdator) {
      // 노드 업데이터에 동일 옵저버가 존재하는지 체크
      const foundIndex = _.findIndex(foundNodeUpdator.nodeObservers, nodeOb =>
        _.isEqual(nodeOb, observer),
      );
      // 동일 옵저버가 존재하지 않을 경우에 추가
      if (foundIndex === -1) {
        foundNodeUpdator.attachObserver(observer);
      }
    }
  }

  /**
   * @param {nodeInfo} nodeInfo
   * @param {Observer} observer 옵저버 제거
   */
  dettachNodeObserver(nodeInfo, observer) {
    const foundNodeUpdator = this.getNodeUpdator(nodeInfo);

    if (foundNodeUpdator) {
      // 노드 업데이터에 동일 옵저버가 존재하는지 체크
      const foundIndex = _.findIndex(foundNodeUpdator.nodeObservers, nodeOb =>
        _.isEqual(nodeOb, observer),
      );
      // 동일 옵저버가 존재하지 않을 경우에 추가
      if (foundIndex !== -1) {
        foundNodeUpdator.dettachObserver(observer);
      }
    }
  }

  /**
   * Node 목록이 갱신되었을 때 NodeUpdator에게 해당 내용 전파
   * @param {nodeInfo[]} nodeList 상태값이 변경된 Node 목록
   */
  updateNodeList(nodeList) {
    nodeList.forEach(nodeInfo => {
      const nodeUpdator = this.getNodeUpdator(nodeInfo);
      if (nodeUpdator) {
        nodeUpdator.notifyObserver(nodeInfo);
      }
    });
  }
}
module.exports = NodeUpdatorManager;
