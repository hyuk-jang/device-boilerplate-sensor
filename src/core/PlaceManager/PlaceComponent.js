const Observer = require('../Updator/Observer');

/**
 */
class PlaceComponent extends Observer {
  static get nodeStatusInfo() {
    return {
      MAX_OVER: 'MAX_OVER',
      UPPER_LIMIT_OVER: 'UPPER_LIMIT_OVER',
      NORMAL: 'NORMAL',
      LOWER_LIMIT_UNDER: 'LOWER_LIMIT_UNDER',
      MIN_UNDER: 'MIN_UNDER',
      UNKNOWN: 'UNKNOWN',
      ERROR: 'ERROR',
    };
  }

  /**
   * Successor Place 정의
   * @param {PlaceComponent} placeComponent
   */
  setParentPlace(placeComponent) {}

  /**
   * Successor Place를 가져옴
   * @return {PlaceComponent}
   */
  getParentPlace() {}

  /**
   *
   * @param {string} placeId placeId와 같은 Place Component 객체를 찾아 반환
   */
  findPlace(placeId) {}

  /**
   * @desc Place Storage, Place Node :::
   * 장소 저장소 객체의 place Id를 가져옴
   * @return {string}
   */
  getPlaceId() {}

  /**
   * @desc Place Storage, Place Node :::
   * 장소 저장소 객체의 place Info를 가져옴
   * @return {placeInfo}
   */
  getPlaceInfo() {}

  /**
   * @desc Place Storage, Place Node :::
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
   * @param {Object} placeNodeInfo NodeId or nodeInfo 객체
   * @param {string=} placeNodeInfo.nodeDefId Node Definition Id (염도, 수위, 후면 온도 등등)
   * @param {nodeId|nodeInfo=} placeNodeInfo.node NodeId or nodeInfo 객체
   * @return {PlaceComponent}
   */
  getPlaceNode(placeNodeInfo) {}

  /**
   * @desc Place Storage, Place Node :::
   * Node Data 반환
   * @return {string}
   */
  getNodeValue() {}

  /**
   * @desc Place Node :::
   * Place Node Status 반환
   * @return {number}
   */
  getNodeStatus() {}

  /**
   * @desc Place Storage, Place Node :::
   * Node Id 반환
   * @param {string=} nodeDefId Storage 일 경우 필수 입력
   * @return {string}
   */
  getNodeId(nodeDefId) {}

  /**
   * @desc Place Node :::
   * Node Def Id 반환
   * @return {string}
   */
  getNodeDefId() {}

  /**
   * 급수지 Place Id 목록 반환
   * @return {PlaceComponent[]}
   */
  getCallPlaceRankList() {}

  /**
   * 배수지 Place Id목록 반환
   * @return {PlaceComponent[]}
   */
  getPutPlaceRankList() {}

  /**
   * 그룹 Place Id 목록 반환
   * @param {string} nodeDefId Node Definition ID
   * @return {PlaceComponent[]}
   */
  getGroupSrcList(nodeDefId) {}

  /** 노드 임계치 */
  getThresholdValue() {}

  /** 노드 최대 임계치 */
  getMaxValue() {}

  /** 노드 상한선 임계치 */
  getUpperLimitValue() {}

  /** 노드 설정 임계치 */
  getSetValue() {}

  /** 노드 하한선 임계치 */
  getLowerLimitValue() {}

  /** 노드 최저 임계치 */
  getMinValue() {}

  /**
   * Place Node가 갱신이 되었을 경우 처리
   * @param {PlaceComponent} placeNode
   */
  handleUpdateNode(placeNode) {}
}

module.exports = PlaceComponent;
