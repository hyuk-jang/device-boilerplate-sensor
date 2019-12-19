const _ = require('lodash');

const { BU } = require('base-util-jh');

const ConcretePlaceThreshold = require('../ConcretePlaceThreshold');

class Salinity extends ConcretePlaceThreshold {
  /**
   * 장치 상태가 식별 불가 일 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleUnknown(placeNode) {}

  /**
   * 장치 상태가 에러일 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleError(placeNode) {}

  /**
   * Node 임계치가 상한선을 넘을 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpperLimitOver(placeNode) {}
}
module.exports = Salinity;
