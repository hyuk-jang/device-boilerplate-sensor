const _ = require('lodash');

const { BU } = require('base-util-jh');

const PlaceThreshold = require('../../../../core/PlaceManager/PlaceThreshold');

class WaterLevelThreAlgo extends PlaceThreshold {
  /**
   * 장치 상태가 식별 불가 일 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeStorage 데이터 갱신이 발생한 장소
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUnknown(coreFacade, placeStorage, placeNode) {}

  /**
   * 장치 상태가 에러일 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeStorage 데이터 갱신이 발생한 장소
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleError(placeComponent) {}

  /**
   * Node 임계치가 최대치를 넘을 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeStorage 데이터 갱신이 발생한 장소
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleMaxOver(placeComponent) {}

  /**
   * Node 임계치가 상한선을 넘을 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeStorage 데이터 갱신이 발생한 장소
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpperLimitOver(placeComponent) {}

  /**
   * Node 임계치가 정상 일 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeStorage 데이터 갱신이 발생한 장소
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleNormal(placeComponent) {}

  /**
   * Node 임계치가 하한선에 못 미칠 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeStorage 데이터 갱신이 발생한 장소
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleLowerLimitUnder(placeComponent) {}

  /**
   * Node 임계치가 최저치에 못 미칠 경우
   * @param {CoreFacade} coreFacade Place Manager
   * @param {PlaceComponent} placeStorage 데이터 갱신이 발생한 장소
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleMinUnder(placeComponent) {}
}
module.exports = WaterLevelThreAlgo;
