const _ = require('lodash');

const { BU } = require('base-util-jh');

const ConcretePlaceThreshold = require('../ConcretePlaceThreshold');

module.exports = class extends ConcretePlaceThreshold {
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
   * Node 임계치가 최대치를 넘을 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleMaxOver(placeNode) {}

  /**
   * Node 임계치가 상한선을 넘을 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpperLimitOver(placeNode) {}

  /**
   * Node 임계치가 정상 일 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleNormal(placeNode) {}

  /**
   * Node 임계치가 하한선에 못 미칠 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleLowerLimitUnder(placeNode) {}

  /**
   * Node 임계치가 최저치에 못 미칠 경우
   * @param {PlaceNode} placeNode 데이터 갱신이 발생한 노드
   */
  handleMinUnder(placeNode) {}
};
