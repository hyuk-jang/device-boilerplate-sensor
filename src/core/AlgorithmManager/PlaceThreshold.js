/**
 * @interface 프로젝트 별로 알고리즘 모드 별로 재정의 필요
 * @description 4 Depth.
 * 해당 구동 모드 중 Node Definition Id에 해당할 경우 실행
 * 해당 구동 모드 중 재정의한 장소 별 임계치를 달성하였을 경우 메소드 실행
 */
class PlaceThreshold {
  /**
   * 장소 임계치 처리 기준이 되는 Node Definition Id
   * @param {string} nodeDefId Node Definition Id
   */
  constructor(nodeDefId = '') {
    this.nodeDefId = nodeDefId;
  }

  /**
   * 장치 상태가 식별 불가 일 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleUnknown(coreFacade, placeNode) {}

  /**
   * 장치 상태가 에러일 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleError(coreFacade, placeNode) {}

  /**
   * Node 임계치가 최대치를 넘을 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleMaxOver(coreFacade, placeNode) {}

  /**
   * Node 임계치가 상한선을 넘을 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpperLimitOver(coreFacade, placeNode) {}

  /**
   * Node 임계치가 정상 일 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleNormal(coreFacade, placeNode) {}

  /**
   * Node 임계치가 하한선에 못 미칠 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleLowerLimitUnder(coreFacade, placeNode) {}

  /**
   * Node 임계치가 최저치에 못 미칠 경우
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleMinUnder(coreFacade, placeNode) {}
}

module.exports = PlaceThreshold;
