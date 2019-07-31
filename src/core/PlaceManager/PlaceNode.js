const _ = require('lodash');

const { BU } = require('base-util-jh');

const PlaceComponent = require('./PlaceComponent');

const CoreFacade = require('../CoreFacade');

class PlaceNode extends PlaceComponent {
  /**
   * 장소에 속해 있는 노드정보 객체
   * @param {nodeInfo} nodeInfo
   * @param {mThresholdConfigInfo=} thresholdConfigInfo 설정된 임계 정보가 있다면 기록
   */
  constructor(nodeInfo, thresholdConfigInfo = {}) {
    super();

    this.nodeInfo = nodeInfo;

    const {
      maxValue,
      upperLimitValue,
      setValue,
      lowerLimitValue,
      minValue,
      callPlaceRankList = [],
      putPlaceRankList = [],
      groupPlaceList = [],
    } = thresholdConfigInfo;

    this.maxValue = maxValue;
    this.upperLimitValue = upperLimitValue;
    this.setValue = setValue;
    this.lowerLimitValue = lowerLimitValue;
    this.minValue = minValue;

    /** 요청 우선 장소 목록 */
    this.callPlaceRankList = callPlaceRankList;
    /** 발신 우선 장소 목록 */
    this.putPlaceRankList = putPlaceRankList;
    /** 특정 조건 충족 시 그룹으로 묶을 장소 목록 */
    this.groupPlaceList = groupPlaceList;

    /** @type {PlaceComponent} */
    this.placeStorage;

    // 현재 노드 상태는 UNKNOWN으로 정의
    this.placeNodeStatus = PlaceComponent.nodeStatusInfo.UNKNOWN;

    const coreFacade = new CoreFacade();
    coreFacade.attachNodeObserver(nodeInfo, this);
  }

  /**
   * 현 Place Node 객체를 가지는 Place Storage 객체
   * @param {PlaceStorage} placeStorage
   */
  setParentPlace(placeStorage) {
    this.placeStorage = placeStorage;
  }

  /**
   * Successor Place를 가져옴
   * @return {PlaceStorage}
   */
  getParentPlace() {
    return this.placeStorage;
  }

  /**
   * @param {string} placeId placeId와 같은 Place Component 객체를 찾아 반환
   */
  findPlace(placeId) {
    return this.placeStorage.findPlace(placeId);
  }

  /**
   * Node Id 반환
   * @return {string}
   */
  getNodeId() {
    return this.nodeInfo.node_id;
  }

  /**
   * Node Def Id 반환
   * @return {string}
   */
  getNodeDefId() {
    return this.nodeInfo.nd_target_id;
  }

  /**
   * Node Data 반환
   * @return {number|string}
   */
  getNodeValue() {
    return this.nodeInfo.data;
  }

  /**
   * Place Node Status 반환
   * @return {string}
   */
  getNodeStatus() {
    return this.placeNodeStatus;
  }

  /**
   * 급수지 Place Storage 목록 반환
   * @return {PlaceStorage[]|PlaceStorage[][]}
   */
  getCallPlaceRankList() {
    // BU.CLI(this.callPlaceRankList);
    return _.map(this.callPlaceRankList, callPlaceId => {
      if (_.isArray(callPlaceId)) {
        return callPlaceId.map(placeId => this.placeStorage.findPlace(placeId));
      }
      return this.placeStorage.findPlace(callPlaceId);
    });
  }

  /**
   * 배수지 Place Storage 목록 반환
   * @return {PlaceStorage[]|PlaceStorage[][]}
   */
  getPutPlaceRankList() {
    return _.map(this.putPlaceRankList, putPlaceId => {
      if (_.isArray(putPlaceId)) {
        return putPlaceId.map(this.placeStorage.findPlace);
      }
      return this.placeStorage.findPlace(putPlaceId);
    });
  }

  /**
   * 그룹 장소 목록 반환
   * @return {PlaceStorage[]}
   */
  getGroupPlaceList() {
    if (this.groupPlaceList.length) {
      return _.map(this.groupPlaceList, placeId => {
        return this.placeStorage.findPlace(placeId);
      });
    }
    return [this.placeStorage];
  }

  /** 노드 임계치 */
  getThresholdValue() {
    return {
      maxValue: this.maxValue,
      upperLimitValue: this.upperLimitValue,
      setValue: this.setValue,
      lowerLimitValue: this.lowerLimitValue,
      minValue: this.minValue,
    };
  }

  /** 노드 최대 임계치 */
  getMaxValue() {
    return _.get(this, 'maxValue.value');
  }

  /** 노드 상한선 임계치 */
  getUpperLimitValue() {
    return _.get(this, 'upperLimitValue.value');
  }

  /** 노드 설정 임계치 */
  getSetValue() {
    return _.get(this, 'setValue.value');
  }

  /** 노드 하한선 임계치 */
  getLowerLimitValue() {
    return _.get(this, 'lowerLimitValue.value');
  }

  /** 노드 최저 임계치 */
  getMinValue() {
    return _.get(this, 'minValue.value');
  }

  /**
   * @desc Place Node :::
   * FIXME: 문자 형태 비교는 차후에....
   * Node Updator 에서 업데이트된 Node 정보를 전달해옴.
   */
  updateNode() {
    const { data } = this.nodeInfo;

    // BU.CLI('updateNode', data);

    let nextNodeStatus;

    if (_.isNumber(data)) {
      nextNodeStatus = this.updateNumValue(data);
    }
    // FIXME: 문자 비교 불가 처리. 차후 수정
    // else if (_.isString(data)) {
    //   nextNodeStatus = this.updateStrValue(data);
    // }
    else {
      nextNodeStatus = PlaceComponent.nodeStatusInfo.UNKNOWN;
    }

    this.placeNodeStatus = nextNodeStatus;

    this.placeStorage.handleUpdateNode(this);
  }

  /**
   * 장소 저장소 객체의 place Id를 가져옴
   * @return {string}
   */
  getPlaceId() {
    return this.placeStorage.getPlaceId();
  }

  /**
   * 장소 저장소 객체의 place Info를 가져옴
   * @return {placeInfo}
   */
  getPlaceInfo() {
    return this.placeStorage.getPlaceInfo();
  }

  /**
   * @return {number=} 현재 장소의 제곱미터
   */
  getSquareMeter() {
    return this.placeStorage.getSquareMeter();
  }

  /**
   * @desc Place Storage :::
   * 장소 노드 객체를 조회하고자 할 경우
   * @param {string} nodeDefId Node Definition Id (염도, 수위, 후면 온도 등등)
   * @return {PlaceNode}
   */
  getPlaceNode(nodeDefId) {
    return this.placeStorage.getPlaceNode(nodeDefId);
  }

  /**
   * @desc Place Node :::
   * @param {number} data number 형식 데이터
   */
  updateNumValue(data) {
    let nextPlaceNodeStatus = this.placeNodeStatus;
    // BU.CLI(deviceData, this.goalRange);
    if (_.isNumber(this.getMaxValue()) && data >= this.getMaxValue()) {
      nextPlaceNodeStatus = PlaceComponent.nodeStatusInfo.MAX_OVER;
      // this.handleMaxOver();
    } else if (_.isNumber(this.getUpperLimitValue()) && data >= this.getUpperLimitValue()) {
      nextPlaceNodeStatus = PlaceComponent.nodeStatusInfo.UPPER_LIMIT_OVER;
      // this.handleUpperLimitOver();
    } else if (_.isNumber(this.getMinValue()) && data <= this.getMinValue()) {
      nextPlaceNodeStatus = PlaceComponent.nodeStatusInfo.MIN_UNDER;
      // this.handleMinUnder();
    } else if (_.isNumber(this.getLowerLimitValue()) && data <= this.getLowerLimitValue()) {
      nextPlaceNodeStatus = PlaceComponent.nodeStatusInfo.LOWER_LIMIT_UNDER;
      // this.handleLowerLimitUnder();
    } else {
      nextPlaceNodeStatus = PlaceComponent.nodeStatusInfo.NORMAL;
      // this.handleNormal();
    }

    // if (this.getPlaceId() === 'BW_1') {
    //   BU.CLI(nextPlaceNodeStatus);
    // }
    return nextPlaceNodeStatus;
  }

  // /**
  //  * @param {string} deviceData string 형식 데이터
  //  */
  // updateStrValue(deviceData) {
  //   // 문자 데이터일 경우에는 달성 목표가 EQUAL이어야만 함. 문자 상하 비교 불가
  //   if (this.goalRange !== goalDataRange.EQUAL) return false;

  //   // 대소 문자의 차이가 있을 수 있으므로 소문자로 변환 후 비교
  //   if (_.lowerCase(deviceData) === _.lowerCase(this.goalValue)) {
  //     this.handleNormal();
  //   }
  // }
}
module.exports = PlaceNode;
