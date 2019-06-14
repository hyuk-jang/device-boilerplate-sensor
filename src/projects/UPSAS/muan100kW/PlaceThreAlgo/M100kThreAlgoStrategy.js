const ThreAlgoStrategy = require('../../../../core/PlaceManager/ThreAlgoStrategy');

const PlaceComponent = require('../../../../core/PlaceManager/PlaceComponent');

const WaterLevelThreAlgo = require('./WaterLevelThreAlgo');

class M100kThreAlgoStrategy extends ThreAlgoStrategy {
  /**
   *
   * @param {PlaceComponent} placeStorage
   */
  constructor(placeStorage) {
    super(placeStorage);
    this.waterLevelThreAlgo = new WaterLevelThreAlgo(this);
  }

  /** @param {PlaceComponent} placeNode 장치 상태가 식별 불가 일 경우 */
  handleUnknown(placeNode) {
    this.waterLevelThreAlgo.handleUnknown(placeNode);
  }

  /** @param {PlaceComponent} placeNode 장치 상태가 에러일 경우 */
  handleError(placeNode) {
    this.waterLevelThreAlgo.handleError(placeNode);
  }

  /** @param {PlaceComponent} placeNode Node 임계치가 최대치를 넘을 경우 */
  handleMaxOver(placeNode) {
    this.waterLevelThreAlgo.handleMaxOver(placeNode);
  }

  /** @param {PlaceComponent} placeNode Node 임계치가 상한선을 넘을 경우 */
  handleUpperLimitOver(placeNode) {
    this.waterLevelThreAlgo.handleUpperLimitOver(placeNode);
  }

  /** @param {PlaceComponent} placeNode Node 임계치가 정상 일 경우 */
  handleNormal(placeNode) {
    this.waterLevelThreAlgo.handleNormal(placeNode);
  }

  /** @param {PlaceComponent} placeNode Node 임계치가 하한선에 못 미칠 경우 */
  handleLowerLimitUnder(placeNode) {
    this.waterLevelThreAlgo.handleLowerLimitUnder(placeNode);
  }

  /** @param {PlaceComponent} placeNode Node 임계치가 최저치에 못 미칠 경우 */
  handleMinUnder(placeNode) {
    this.waterLevelThreAlgo.handleMinUnder(placeNode);
  }
}
module.exports = M100kThreAlgoStrategy;
