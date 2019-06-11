const Observer = require('../Updator/Observer');

/**
 * @interface
 */
class PlaceComponent extends Observer {
  /**
   * notifyClear을 성공하였을 경우 알릴 Successor
   * @param {PlaceComponent} placeComponent
   */
  setPlace(placeComponent) {}

  /**
   * @desc Place Storage :::
   * 장소 저장소 객체의 place Id를 가져옴
   */
  getPlaceId() {}

  /**
   * @desc Place Storage :::
   * 장소 저장소 객체의 place Info를 가져옴
   */
  getPlaceInfo() {}

  /**
   * @desc Place Storage :::
   * @return {number=} 현재 장소의 제곱미터
   */
  getSquareMeter() {}

  /**
   * @desc Place Storage :::
   * @param {PlaceComponent} placeComponent
   */
  addPlaceNode(placeComponent) {}

  /**
   * @desc Place Storage :::
   * @param {PlaceComponent} placeComponent
   */
  removePlaceNode(placeComponent) {}

  /**
   * @desc Place Storage :::
   * 장소 노드 객체를 조회하고자 할 경우
   * @param {nodeId|nodeInfo} node NodeId or nodeInfo 객체
   * @return {PlaceComponent}
   */
  getPlaceNode(node) {}

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

module.exports = PlaceComponent;
