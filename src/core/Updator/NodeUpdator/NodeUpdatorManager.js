const _ = require('lodash');

const NodeUpdator = require('./NodeUpdator');

class NodeUpdatorManager {
  /** @param {nodeInfo[]} nodeList */
  constructor(nodeList) {
    this.nodeList = nodeList;

    this.nodeUpdatorList = nodeList.map(nodeInfo => {
      return new NodeUpdator(nodeInfo);
    });
  }

  /**
   * Node Id를 가진 Node 객체 반환
   * @param {string} nodeId Node Id
   */
  getNodeInfo(nodeId) {
    return _.find(this.nodeList, { node_id: nodeId });
  }

  /**
   * 노드 정보를 가진 Node Updator 조회
   * @param {nodeInfo|string} node nodeId or nodeInfo 객체
   */
  getNodeUpdator(node) {
    if (_.isString(node)) {
      node = this.getNodeInfo(node);
    }

    return _.find(this.nodeUpdatorList, nodeUpdator => _.isEqual(nodeUpdator.nodeInfo, node));
  }

  /**
   * @param {nodeInfo|string} nodeInfo nodeId or nodeInfo 객체
   * @param {Observer} observer 옵저버 추가
   * @param {boolean=} isHeader 옵저버의 위치를 가장 앞쪽 배치 여부
   */
  attachNodeObserver(nodeInfo, observer, isHeader) {
    const foundNodeUpdator = this.getNodeUpdator(nodeInfo);
    // 노드가 존재하지 않는다면 종료
    if (_.isEmpty(foundNodeUpdator)) return false;

    // 노드 업데이터에 동일 옵저버가 존재하는지 체크
    const foundIndex = _.findIndex(foundNodeUpdator.observers, nodeOb =>
      _.isEqual(nodeOb, observer),
    );

    // console.log(foundIndex, nodeInfo);
    // 동일 옵저버가 존재하지 않을 경우에 추가
    if (foundIndex === -1) {
      foundNodeUpdator.attachObserver(observer, isHeader);
    }
  }

  /**
   * @param {nodeInfo|string} nodeInfo nodeId or nodeInfo 객체
   * @param {Observer} observer 옵저버 제거
   */
  dettachNodeObserver(nodeInfo, observer) {
    const foundNodeUpdator = this.getNodeUpdator(nodeInfo);

    if (foundNodeUpdator) {
      // 노드 업데이터에 동일 옵저버가 존재하는지 체크
      const foundIndex = _.findIndex(foundNodeUpdator.observers, nodeOb =>
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
