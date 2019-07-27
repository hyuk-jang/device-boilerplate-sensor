const _ = require('lodash');

const Observer = require('./Observer');

class Updator {
  constructor() {
    this.observers = [];
  }

  /** @param {Observer} newObserver 옵저버 추가 */
  attachObserver(newObserver) {
    const foundIndex = _.findIndex(this.observers, ob => _.isEqual(ob, newObserver));
    // 동일 옵저버가 존재하지 않을 경우에 추가
    if (foundIndex === -1) {
      this.observers.push(newObserver);
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
