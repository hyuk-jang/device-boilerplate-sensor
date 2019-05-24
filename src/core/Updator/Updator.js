const Observer = require('./Observer');

class Updator {
  /** @param {Observer} observer 옵저버 추가 */
  attachObserver(observer) {}

  /** @param {Observer} observer 옵저버 제거 */
  dettachObserver(observer) {}

  /** @param {*} notifyData 옵저버 들에게 알릴 데이터 */
  notifyObserver(notifyData) {}
}
module.exports = Updator;
