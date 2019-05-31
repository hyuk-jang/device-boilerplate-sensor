const Observer = require('../Updator/Observer');

/**
 * @interface
 */
class PlaceComponent extends Observer {
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
   * 세부 목표를 완료했다고 알려 올 세부 객체
   * @param {PlaceComponent} placeComponent
   * @return {PlaceComponent}
   */
  handleThreshold(placeComponent) {}

  /**
   * 해당 장소의 염도치를 가져옴.
   * @param {string=} placeId 장소 ID place_id
   * @return {number}
   */
  getSalinity(placeId) {}

  /**
   * 해당 장소의 수위를 가져옴.
   * @param {string=} placeId 장소 ID place_id
   * @return {number}
   */
  getWaterLevel() {}

  /**
   * 해당 장소의 모듈 후면 온도를 가져옴.
   * @param {string=} placeId 장소 ID place_id
   * @return {number}
   */
  getModuleRearTemp() {}

  /**
   * 해당 장소의 염수 온도를 가져옴.
   * @param {string=} placeId 장소 ID place_id
   * @return {number}
   */
  getBrineTemp() {}

  /**
   * 해당 장소의 수문 타입을 가져옴. 수문 종류(배수, 급수, 동일)
   * @param {string=} placeId 장소 ID place_id
   * @return {string}
   */
  getWaterDoorType() {}
}

module.exports = PlaceComponent;
