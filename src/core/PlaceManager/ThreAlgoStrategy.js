const PlaceStorage = require('./PlaceStorage');

const ThresholdAlgorithm = require('./ThresholdAlgorithm');

class ThreAlgoStrategy {
  /**
   *
   * @param {PlaceStorage} placeStorage
   */
  constructor(placeStorage) {
    this.placeStorage = placeStorage;
  }

  /** @param {PlaceComponent} placeComponent 장치 상태가 식별 불가 일 경우 */
  handleUnknown(placeComponent) {}

  /** @param {PlaceComponent} placeComponent 장치 상태가 에러일 경우 */
  handleError(placeComponent) {}

  /** @param {PlaceComponent} placeComponent Node 임계치가 최대치를 넘을 경우 */
  handleMaxOver(placeComponent) {}

  /** @param {PlaceComponent} placeComponent Node 임계치가 상한선을 넘을 경우 */
  handleUpperLimitOver(placeComponent) {}

  /** @param {PlaceComponent} placeComponent Node 임계치가 정상 일 경우 */
  handleNormal(placeComponent) {}

  /** @param {PlaceComponent} placeComponent Node 임계치가 하한선에 못 미칠 경우 */
  handleLowerLimitUnder(placeComponent) {}

  /** @param {PlaceComponent} placeComponent Node 임계치가 최저치에 못 미칠 경우 */
  handleMinUnder(placeComponent) {}
}
