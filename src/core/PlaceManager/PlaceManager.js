const _ = require('lodash');

const { BU } = require('base-util-jh');

const CoreFacade = require('../CoreFacade');

const PlaceComponent = require('./PlaceComponent');
const PlaceStorage = require('./PlaceStorage');
const PlaceNode = require('./PlaceNode');

class PlaceManager extends PlaceComponent {
  constructor() {
    super();

    /** @type {PlaceStorage[]} */
    this.placeStorageList = [];

    const coreFacade = new CoreFacade();
    // Core Facade에 Place Manager와 Place Algorithm 세팅
    coreFacade.setPlaceManager(this);
  }

  /**
   * Place List 만큼 저장소 객체를 생성
   * Place Realtion List 에 지정되어 있는 Node 와의 관계를 고려하여 Place Node 객체 생성 및 자식 객체로 등록
   * @param {Model} model
   */
  init(model) {
    const { nodeList, placeList, placeRelationList } = model;

    // Place 를 기준으로 Node 가 존재하는 개체만 생성
    placeRelationList.forEach(plaRelInfo => {
      // Place Relation 정보에는 Node 및 Place 생성 정보가 없기 때문에 객체 정보를 불러오기 위한 키
      const { place_id: placeId, node_id: nodeId } = plaRelInfo;

      // 장소 정보
      const placeInfo = _.find(placeList, { place_id: placeId });
      // 노드 정보
      const nodeInfo = _.find(nodeList, { node_id: nodeId });

      // 장소목록과 노드 목록에 해당 Place Relation Info 정보가 있어야만 진행
      if (!placeInfo && !nodeInfo) {
        return false;
      }

      // 장소 저장소 객체 생성
      const placeStorage = new PlaceStorage(placeInfo);
      // Singleton Pattern에 의거 기존 생성 개체와 동일한 객체가 존재하는지 체크 후 없다면 리스트에 삽입
      if (_.isEmpty(_.find(this.placeStorageList, placeStorage))) {
        placeStorage.setParentPlace(this);
        this.placeStorageList.push(placeStorage);
      }

      /** @type {mThresholdConfigInfo[]} 임계치 설정 목록을 불러옴. */
      const thresholdConfigList = _.get(placeInfo, 'place_info.thresholdConfigList', []);
      /** @type {mThresholdConfigInfo} Place Node의 2번째 인자값을 결정하기 위한 임계치 정보 */
      let thresholdConfigInfo = {};

      // 현재 장소에 임계치 설정 정보가 존재할 경우 현재 Node가 해당 되는지 체크하고 부합된다면 임계치 설정 정보 반영
      if (thresholdConfigList.length) {
        thresholdConfigInfo = _.find(thresholdConfigList, { ndId: nodeInfo.nd_target_id });
      }

      // 장소 노드 생성 및 추가 및 저장소 바인딩
      const placeNode = new PlaceNode(nodeInfo, thresholdConfigInfo);
      placeNode.setParentPlace(placeStorage);

      placeStorage.addPlaceNode(placeNode);
    });
  }

  /**
   *
   * @param {string} placeId placeId와 같은 Place Component 객체를 찾아 반환
   */
  findPlace(placeId) {
    // BU.CLI('findPlace', placeId);
    return _.find(this.placeStorageList, placeStorage => {
      return _.eq(placeId, placeStorage.placeInfo.place_id);
    });
  }

  /**
   *
   * @param {string|placeInfo} place 장소 id
   */
  getPlaceStorage(place) {
    // BU.CLI(placeId);
    // 장소 정보라면 placeId를 추출하여 재정의
    if (_.isObject(place)) {
      place = place.place_id;
    }

    return _.find(this.placeStorageList, placeStorage => {
      return placeStorage.getPlaceId() === place;
    });
  }

  /**
   * Place Node가 갱신이 되었을 경우 처리
   * @param {PlaceComponent} placeNode
   */
  handleUpdateNode(placeNode) {
    const coreFacade = new CoreFacade();
    coreFacade.handleUpdateNode(placeNode);
  }
}
module.exports = PlaceManager;
