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

    // BU.CLI(placeInfo);

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
   * @desc Place Storage :::
   * 장소 저장소 객체의 place Id를 가져옴
   */
  getPlaceId() {
    return this.placeInfo.place_id;
  }

  /**
   * @desc Place Storage :::
   * 장소 저장소 객체의 place Info를 가져옴
   */
  getPlaceInfo() {
    return this.placeInfo;
  }

  /**
   * @desc Place Storage :::
   * @return {number=} 현재 장소의 제곱미터
   */
  getSquareMeter() {
    // 만약 면적을 구하는데 필요한 값을 가져오는데 문제가 발생하였다면 현재 면적은 없는 것으로 판단
    try {
      const { width, height } = this.placeSize;
      return _.round(_.multiply(width, height), 1);
    } catch (error) {
      return undefined;
    }
  }

  /**
   * @desc Place Storage :::
   * @param {PlaceComponent} placeComponent
   */
  addPlaceNode(placeComponent) {
    // 이미 존재한다면 false 반환
    if (_.findIndex(this.children, placeComponent) !== -1) return false;

    // 삽입 후 true 반환
    return this.children.push(placeComponent) && true;
  }

  /**
   * @desc Place Storage :::
   * @param {PlaceComponent} placeComponent
   */
  removePlaceNode(placeComponent) {
    // 해당 인자가 존재할 경우 삭제 후 true 반환
    if (_.findIndex(this.children, placeComponent) === -1) {
      _.pull(this.children, placeComponent);
      return true;
    }
    return false;
  }

  /**
   * @desc Place Storage :::
   * 장소 노드 객체를 조회하고자 할 경우
   * @param {nodeId|nodeInfo} node NodeId or nodeInfo 객체
   * @return {PlaceComponent}
   */
  getPlaceNode(node) {
    if (_.isString(node)) {
      return _.find(this.children, placeNode => {
        return placeNode.getNodeId() === node;
      });
    }

    return _.find(this.children, { nodeInfo: node });
  }

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

module.exports = PlaceStorage;
