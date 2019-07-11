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
    this.nodeObservers = [];
  }

  /**
   * 존재하는 옵저버 중 해당 옵저버를 추출
   * @param {*} observer
   */
  getObserver(observer) {
    return _.find(this.nodeObservers, nodeOb => _.isEqual(nodeOb, observer));
  }

  /** @param {Observer} observer 옵저버 추가 */
  attachObserver(observer) {
    const foundIndex = _.findIndex(this.nodeObservers, nodeOb => _.isEqual(nodeOb, observer));
    // BU.CLI(foundIndex);
    // BU.CLIN(observer, 1);
    // 동일 옵저버가 존재하지 않을 경우에 추가
    if (foundIndex === -1) {
      this.nodeObservers.push(observer);
    }
  }

  /** @param {Observer} observer 옵저버 제거 */
  dettachObserver(observer) {
    // BU.CLIN(this.nodeObservers);
    // 대상이 존재하는지 확인
    const foundIndex = _.findIndex(this.nodeObservers, nodeOb => _.isEqual(nodeOb, observer));
    // 해당 옵저버 제거
    if (foundIndex !== -1) {
      _.pullAt(this.nodeObservers, [foundIndex]);
    }
  }

  /** @param {nodeInfo} nodeInfo 옵저버들에게 노드 변경 알림 */
  notifyObserver(nodeInfo) {
    const cloneObservers = _.clone(this.nodeObservers);
    cloneObservers.forEach(nodeOb => {
      nodeOb.updateNode(nodeInfo);
    });
  }
}
module.exports = NodeUpdator;
