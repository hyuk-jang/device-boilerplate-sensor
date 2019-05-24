const _ = require('lodash');

const Updator = require('./Updator');

class ControlModelUpdator extends Updator {
  constructor() {
    super();
    this.children = [];
  }

  /** @param {Observer} observer 옵저버 추가 */
  attachObserver(observer) {
    const foundIndex = _.findIndex(this.children, child => _.isEqual(child, observer));
    // 동일 옵저버가 존재하지 않을 경우에 추가
    if (foundIndex === -1) {
      this.children.push(observer);
    }
  }

  /** @param {Observer} observer 옵저버 제거 */
  dettachObserver(observer) {
    // 대상이 존재하는지 확인
    const foundIndex = _.findIndex(this.children, child => _.isEqual(child, observer));
    // 해당 옵저버 제거
    if (foundIndex !== -1) {
      _.pullAt(this.children, [foundIndex]);
    }
  }

  /** @param {nodeInfo} nodeInfo 노드 상태 변경 알림 */
  notifyObserver(nodeInfo) {
    this.children.forEach(child => {
      child.updateNode(nodeInfo);
    });
  }
}
module.exports = ControlModelUpdator;
