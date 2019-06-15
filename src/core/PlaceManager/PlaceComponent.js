const Observer = require('../Updator/Observer');

/**
 */
class PlaceComponent extends Observer {
  /**
   * Successor Place 정의
   * @param {PlaceComponent} placeComponent
   */
  setParentPlace(placeComponent) {}

  /**
   * Successor Place를 가져옴
   */
  getParentPlace() {}

  /**
   *
   * @param {string} placeId placeId와 같은 Place Component 객체를 찾아 반환
   */
  findPlace(placeId) {}

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
   * 장소 노드 객체를 조회하고자 할 경우
   * @param {nodeId|nodeInfo} node NodeId or nodeInfo 객체
   * @return {PlaceComponent}
   */
  getPlaceNode(node) {}

  /**
   * @desc Place Node :::
   * Node Data 반환
   * @return {string}
   */
  getValue() {}

  /**
   * @desc Place Node :::
   * Place Node Status 반환
   * @return {number}
   */
  getNodeStatus() {}

  /**
   * @desc Place Node :::
   * Node Id 반환
   * @return {string}
   */
  getNodeId() {}

  /**
   * @desc Place Node :::
   * Node Def Id 반환
   * @return {string}
   */
  getNodeDefId() {}

  /**
   * @desc Place Node :::
   * 급수지 Place Id 목록 반환
   * @return {string[]}
   */
  getCallPlaceRankList() {}

  /**
   * @desc Place Node :::
   * 배수지 Place Id목록 반환
   * @return {string[]}
   */
  getPutPlaceRankList() {}

  /** @desc Place Node ::: 노드 최대 임계치 */
  getMaxValue() {}

  /** @desc Place Node ::: 노드 상한선 임계치 */
  getUpperLimitValue() {}

  /** @desc Place Node ::: 노드 설정 임계치 */
  getSetValue() {}

  /** @desc Place Node ::: 노드 하한선 임계치 */
  getLowerLimitValue() {}

  /** @desc Place Node ::: 노드 최저 임계치 */
  getMinValue() {}

  /**
   * Place Node가 갱신이 되었을 경우 처리
   * @param {PlaceComponent} placeNode
   */
  handleUpdateNode(placeNode) {}
}

module.exports = PlaceComponent;
