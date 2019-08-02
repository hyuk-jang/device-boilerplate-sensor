const _ = require('lodash');

const Observer = require('./Observer');

class Updator {
  constructor() {
    /** @type {Observer[]} */
    this.observers = [];
  }

  /**
   * @param {Observer} newObserver 옵저버 추가
   * @param {boolean=} isHeader 옵저버의 위치를 가장 앞쪽 배치 여부
   */
  attachObserver(newObserver, isHeader) {
    const foundIndex = _.findIndex(this.observers, ob => _.isEqual(ob, newObserver));
    // 동일 옵저버가 존재하지 않을 경우에 추가
    if (foundIndex === -1) {
      isHeader ? this.observers.unshift(newObserver) : this.observers.push(newObserver);
    }
  }

  /** @param {Observer} existObserver 옵저버 제거 */
  dettachObserver(existObserver) {
    // 대상이 존재하는지 확인
    const foundIndex = _.findIndex(this.observers, ob => _.isEqual(ob, existObserver));
    // 해당 옵저버 제거
    if (foundIndex !== -1) {
      _.pullAt(this.observers, [foundIndex]);
    }
  }

  /** @param {*} notifyData 옵저버 들에게 알릴 데이터 */
  notifyObserver(notifyData) {}
}
module.exports = Updator;
