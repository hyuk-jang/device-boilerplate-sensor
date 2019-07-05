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

    // 싱글톤 패턴에 의한 동일 객체라면 기존 객체 반환
    if (!_.isEmpty(existPlaceStorage)) {
      return existPlaceStorage;
    }

    // 신규 객체라면 instance 목록에 추가
    placeStorageList.push(this);

    /** @type {mPlaceInfo} 장소 면적과 임계치에 관련된 정보  */
    const customPlaceInfo = placeInfo.place_info;

    // 장소 정보는 프로퍼티로 정의
    this.placeInfo = placeInfo;

    // 면적 정보가 있다면 정의, 아니라면 false
    this.placeSize = customPlaceInfo && customPlaceInfo.placeSize;

    /** @type {PlaceComponent[]} */
    this.children = [];
  }

  /**
   * 현 Place Component 객체를 가지는 Place Component 객체
   * @param {PlaceComponent} placeManager
   */
  setParentPlace(placeManager) {
    this.placeManager = placeManager;
  }

  /**
   * Successor Place를 가져옴
   * @return {PlaceComponent}
   */
  getParentPlace() {
    return this.placeManager;
  }

  /**
   * @param {string} placeId placeId와 같은 Place Component 객체를 찾아 반환
   */
  findPlace(placeId) {
    if (_.eq(placeId, this.placeInfo.place_id)) {
      return this;
    }
    return this.placeManager.findPlace(placeId);
  }

  /**
   * Node Id 반환
   * @param {string} nodeDefId
   * @return {string}
   */
  getNodeId(nodeDefId) {
    return this.getPlaceNode({ nodeDefId }).getNodeId();
  }

  /**
   * Node Def Id 반환
   * @param {string} nodeDefId
   * @return {string}
   */
  getNodeDefId(nodeDefId) {
    return this.getPlaceNode({ nodeDefId }).getNodeDefId();
  }

  /**
   * Node Data 반환
   * @param {string} nodeDefId Node Definition ID
   * @return {number|string}
   */
  getNodeValue(nodeDefId) {
    return this.getPlaceNode({ nodeDefId }).getNodeValue();
  }

  /**
   * Place Node Status 반환
   * @param {string} nodeDefId Node Definition ID
   * @return {string}
   */
  getNodeStatus(nodeDefId) {
    return this.getPlaceNode({ nodeDefId }).getNodeStatus();
  }

  /**
   * 급수지 Place Id 목록 반환
   * @param {string} nodeDefId Node Definition ID
   * @return {PlaceStorage[]}
   */
  getCallPlaceRankList(nodeDefId) {
    return this.getPlaceNode({ nodeDefId }).getCallPlaceRankList();
  }

  /**
   * 급수지 Place Id 목록 반환
   * @param {string} nodeDefId Node Definition ID
   * @return {PlaceStorage[]}
   */
  getPutPlaceRankList(nodeDefId) {
    return this.getPlaceNode({ nodeDefId }).getPutPlaceRankList();
  }

  /**
   * 그룹 Place Id 목록 반환
   * @param {string} nodeDefId Node Definition ID
   * @return {PlaceStorage[]}
   */
  getGroupSrcList(nodeDefId) {
    return this.getPlaceNode({ nodeDefId }).getGroupSrcList();
  }

  /** @param {string} nodeDefId Node Definition ID 노드 임계치 */
  getThresholdValue(nodeDefId) {
    return this.getPlaceNode({ nodeDefId }).getThresholdValue();
  }

  /** @param {string} nodeDefId Node Definition ID 노드 최대 임계치 */
  getMaxValue(nodeDefId) {
    this.getPlaceNode({ nodeDefId }).getMaxValue();
  }

  /** @param {string} nodeDefId Node Definition ID 노드 상한선 임계치 */
  getUpperLimitValue(nodeDefId) {
    this.getPlaceNode({ nodeDefId }).getUpperLimitValue();
  }

  /** @param {string} nodeDefId Node Definition ID 노드 설정 임계치 */
  getSetValue(nodeDefId) {
    this.getPlaceNode({ nodeDefId }).getSetValue();
  }

  /** @param {string} nodeDefId Node Definition ID 노드 하한선 임계치 */
  getLowerLimitValue(nodeDefId) {
    this.getPlaceNode({ nodeDefId }).getLowerLimitValue();
  }

  /** @param {string} nodeDefId Node Definition ID 노드 최저 임계치 */
  getMinValue(nodeDefId) {
    this.getPlaceNode({ nodeDefId }).getMinValue();
  }

  /**
   * Place Node에 갱신 이벤트를 보내고자 할 경우
   * @param {string|string[]=} nodeDefId Node Definition ID, 없을 경우 전체 갱신
   */
  updateNode(nodeDefId) {
    if (_.isEmpty(nodeDefId)) {
      this.children.forEach(child => {
        child.updateNode();
      });
    } else if (_.isString(nodeDefId) && nodeDefId.length) {
      this.getPlaceNode({ nodeDefId }).updateNode();
    }
  }

  /**
   * 장소 저장소 객체의 place Id를 가져옴
   * @return {string}
   */
  getPlaceId() {
    return this.placeInfo.place_id;
  }

  /**
   * 장소 저장소 객체의 place Info를 가져옴
   * @return {placeInfo}
   */
  getPlaceInfo() {
    return this.placeInfo;
  }

  /**
   * @return {number=} 현재 장소의 제곱미터
   */
  getSquareMeter() {
    // 만약 면적을 구하는데 필요한 값을 가져오는데 문제가 발생하였다면 현재 면적은 없는 것으로 판단
    try {
      // BU.CLI(this.placeSize);
      const { width, height } = this.placeSize;
      // BU.CLIS(width, height);
      return _.round(_.divide(_.multiply(width, height), 10000), 1);
    } catch (error) {
      return undefined;
    }
  }

  /**
   * @desc Place Storage :::
   * @param {PlaceNode} placeNode
   */
  addPlaceNode(placeNode) {
    // 이미 존재한다면 false 반환
    if (_.findIndex(this.children, placeNode) !== -1) return false;

    // 삽입 후 true 반환
    return this.children.push(placeNode) && true;
  }

  /**
   * @desc Place Storage :::
   * 장소 노드 객체를 조회하고자 할 경우
   * @param {Object} placeNodeInfo NodeId or nodeInfo 객체
   * @param {string=} placeNodeInfo.nodeDefId Node Definition Id (염도, 수위, 후면 온도 등등)
   * @param {nodeId|nodeInfo=} placeNodeInfo.node NodeId or nodeInfo 객체
   * @return {PlaceNode}
   */
  getPlaceNode(placeNodeInfo) {
    const { node, nodeDefId } = placeNodeInfo;

    // 노드 정보가 명시되었을 경우
    if (node) {
      // nodeId 형태로 넘어올 경우
      if (_.isString(node)) {
        return _.find(this.children, placeNode => {
          return placeNode.getNodeId() === node;
        });
      }

      // nodeInfo 형태로 넘어올 경우
      return _.find(this.children, { nodeInfo: node });
    }
    // node Def Id로 찾을 경우
    if (_.isString(nodeDefId)) {
      return _.find(this.children, placeNode => {
        return placeNode.getNodeDefId() === nodeDefId;
      });
    }
  }

  /**
   * Place Node가 갱신이 되었을 경우 처리
   * @param {PlaceComponent} placeNode
   */
  handleUpdateNode(placeNode) {
    this.placeManager.handleUpdateNode(placeNode);
  }
}

module.exports = PlaceStorage;
