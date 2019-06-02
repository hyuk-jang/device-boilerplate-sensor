const _ = require('lodash');

const { BU } = require('base-util-jh');

const PlaceComponent = require('./PlaceComponent');

/** @type {PlaceStorage[]} */
const placeStorageList = [];

/**
 * 장소 당 하나의 객체 생성.
 */
class PlaceStorage extends PlaceComponent {
  /**
   * @param {placeInfo} placeInfo
   */
  constructor(placeInfo) {
    super();

    // 기존에 PlaceInfo 객체가 존재한다면 재생성 하지 않음
    const existPlaceStorage = _.find(placeStorageList, placeStorage => {
      return placeStorage.placeInfo === placeInfo;
    });

    if (!_.isEmpty(existPlaceStorage)) {
      return existPlaceStorage;
    }

    this.placeInfo = placeInfo;

    this.placeSize;

    const { place_info: customPlaceInfo } = placeInfo;

    // DB에 들어가있는 세부 장소 정보는 long text 형태이므로 데이터가 변환할 수 있을 경우 JSON 객체로 변환 후 재 지정
    if (_.isString(customPlaceInfo) && BU.IsJsonString(customPlaceInfo)) {
      /** @type {mPlaceInfo} */
      const customPlace = JSON.parse(customPlaceInfo);

      this.placeSize = customPlace.placeSize;
    }

    /** @type {PlaceComponent[]} */
    this.children = [];

    placeStorageList.push(this);
  }

  /**
   * @desc Place Storage
   * Place Storage 객체의 place Id를 가져옴
   */
  getPlaceId() {
    return this.placeInfo.place_id;
  }

  /**
   * @desc Place Storage
   * Place Storage 객체의 place Info를 가져옴
   */
  getPlaceInfo() {
    return this.placeInfo;
  }

  /** @param {PlaceComponent} placeComponent */
  addPlaceNode(placeComponent) {
    // 이미 존재한다면 false 반환
    if (_.findIndex(this.children, placeComponent) !== -1) return false;

    // 삽입 후 true 반환
    return this.children.push(placeComponent) && true;
  }

  /** @param {PlaceComponent} placeComponent */
  removePlaceNode(placeComponent) {
    // 해당 인자가 존재할 경우 삭제 후 true 반환
    if (_.findIndex(this.children, placeComponent) === -1) {
      _.pull(this.children, placeComponent);
      return true;
    }
    return false;
  }

  /**
   * 임계치 저장소를 조회하고자 할 경우
   * @param {nodeInfo} nodeInfo Node ID
   * @return {ThreCmdComponent}
   */
  getPlaceNode(nodeInfo) {
    return _.find(this.children, { nodeInfo });
  }

  /**
   * 세부 목표를 완료했다고 알려 올 세부 객체
   * @param {PlaceComponent} placeComponent
   * @return {PlaceComponent}
   */
  handleThreshold(placeComponent) {}
}

module.exports = PlaceStorage;
