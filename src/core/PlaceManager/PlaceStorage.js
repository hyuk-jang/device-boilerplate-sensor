const _ = require('lodash');

const PlaceComponent = require('./PlaceComponent');

/**
 * 장소 당 하나의 객체 생성.
 */
class PlaceStorage extends PlaceComponent {
  /** @param {placeInfo} placeInfo */
  constructor(placeInfo) {
    super();

    this.placeInfo = placeInfo;

    /** @type {PlaceComponent[]} */
    this.children = [];
  }

  /**
   * notifyClear을 성공하였을 경우 알릴 Successor
   * @param {PlaceComponent} placeComponent
   */
  setSuccessor(placeComponent) {}

  /** @param {PlaceComponent} placeComponent */
  addPlaceStorage(placeComponent) {}

  /** @param {PlaceComponent} placeComponent */
  removePlaceStorage(placeComponent) {}

  /**
   * 임계치 저장소를 조회하고자 할 경우
   * @param {string} nodeId Node ID
   * @return {ThreCmdComponent}
   */
  getPlaceNode(nodeId) {
    return _.find(this.children, { nodeId });
  }

  /**
   * 세부 목표를 완료했다고 알려 올 세부 객체
   * @param {PlaceComponent} placeComponent
   * @return {PlaceComponent}
   */
  handleThreshold(placeComponent) {}
}

module.exports = PlaceStorage;
