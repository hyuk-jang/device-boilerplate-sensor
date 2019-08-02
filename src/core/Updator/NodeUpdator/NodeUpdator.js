const _ = require('lodash');

const { BU } = require('base-util-jh');

const Updator = require('../Updator');

class NodeUpdator extends Updator {
  /**
   * @param {nodeInfo} nodeInfo 노드 정보
   */
  constructor(nodeInfo) {
    super();
    this.nodeInfo = nodeInfo;
  }

  /**
   * 존재하는 옵저버 중 해당 옵저버를 추출
   * @param {*} observer
   */
  getObserver(observer) {
    return _.find(this.observers, nodeOb => _.isEqual(nodeOb, observer));
  }

  /** @param {nodeInfo} nodeInfo 옵저버들에게 노드 변경 알림 */
  notifyObserver(nodeInfo) {
    const cloneObservers = _.clone(this.observers);
    cloneObservers.forEach(nodeOb => {
      nodeOb.updateNode(nodeInfo);
    });
  }
}
module.exports = NodeUpdator;
