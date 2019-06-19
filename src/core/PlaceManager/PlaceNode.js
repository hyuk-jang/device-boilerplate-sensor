const _ = require('lodash');

const { BU } = require('base-util-jh');

const PlaceComponent = require('./PlaceComponent');

const CoreFacade = require('../CoreFacade');

const {
  dcmConfigModel: { placeNodeStatus },
} = require('../../../../default-intelligence');

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

    /** @type {PlaceComponent} */
    this.placeStorage;

    // 현재 노드 상태는 UNKNOWN으로 정의
    this.placeNodeStatus = placeNodeStatus.UNKNOWN;

    const coreFacade = new CoreFacade();
    coreFacade.attachNodeObserver(nodeInfo, this);
  }

  /**
   * @desc Place Node :::
   * 현 Place Node 객체를 가지는 Place Storage 객체
   * @param {PlaceComponent} placeComponent
   */
  setParentPlace(placeComponent) {
    this.placeStorage = placeComponent;
  }

  /**
   * Successor Place를 가져옴
   */
  getParentPlace() {
    return this.placeStorage;
  }

  /**
   * @desc Place Node :::
   * Node Data 반환
   * @return {string}
   */
  getValue() {
    return this.nodeInfo.data;
  }

  /**
   * @desc Place Node :::
   * Place Node Status 반환
   * @return {number}
   */
  getNodeStatus() {
    return this.placeNodeStatus;
  }

  /**
   * @desc Place Node :::
   * Node Id 반환
   * @return {string}
   */
  getNodeId() {
    return this.nodeInfo.node_id;
  }

  /**
   * @desc Place Node :::
   * Node Def Id 반환
   * @return {string}
   */
  getNodeDefId() {
    return this.nodeInfo.nd_target_id;
  }

  /**
   * @desc Place Storage, Place Node :::
   * 장소 저장소 객체의 place Id를 가져옴
   * @return {string}
   */
  getPlaceId() {
    return this.placeStorage.getPlaceId();
  }

  /**
   * @desc Place Storage, Place Node :::
   * 장소 저장소 객체의 place Info를 가져옴
   * @return {placeInfo}
   */
  getPlaceInfo() {
    return this.placeStorage.getPlaceInfo();
  }

  /**
   * @desc Place Storage, Place Node :::
   * @return {number=} 현재 장소의 제곱미터
   */
  getSquareMeter() {
    return this.placeStorage.getSquareMeter();
  }

  /**
   * @desc Place Node :::
   * 급수지 Place Id 목록 반환
   * @return {PlaceComponent[]}
   */
  getCallPlaceRankList() {
    return _.map(this.callPlaceRankList, callPlaceId => {
      return this.placeStorage.findPlace(callPlaceId);
    });
  }

  /**
   * @desc Place Node :::
   * 배수지 Place Id목록 반환
   * @return {PlaceComponent[]}
   */
  getPutPlaceRankList() {
    return _.map(this.putPlaceRankList, putPlaceId => {
      return this.placeStorage.findPlace(putPlaceId);
    });
    // return this.putPlaceRankList;
  }

  /** @desc Place Node ::: 노드 최대 임계치 */
  getMaxValue() {
    return this.maxValue;
  }

  /** @desc Place Node ::: 노드 상한선 임계치 */
  getUpperLimitValue() {
    return this.upperLimitValue;
  }

  /** @desc Place Node ::: 노드 설정 임계치 */
  getSetValue() {
    return this.setValue;
  }

  /** @desc Place Node ::: 노드 하한선 임계치 */
  getLowerLimitValue() {
    return this.lowerLimitValue;
  }

  /** @desc Place Node ::: 노드 최저 임계치 */
  getMinValue() {
    return this.minValue;
  }

  /**
   * @desc Place Node :::
   * FIXME: 문자 형태 비교는 차후에....
   * Node Updator 에서 업데이트된 Node 정보를 전달해옴.
   * 데이터가 달성 목표에 도달하였다면 Critical Stroage에 알림.
   * @param {nodeInfo} nodeInfo
   */
  updateNode(nodeInfo) {
    // BU.CLIN(nodeInfo);
    const { data } = nodeInfo;

    // const prevNodeStatus = this.placeNodeStatus;

    let nextNodeStatus;

    if (_.isNumber(data)) {
      nextNodeStatus = this.updateNumValue(data);
    }
    // FIXME: 문자 비교 불가 처리. 차후 수정
    // else if (_.isString(data)) {
    //   nextNodeStatus = this.updateStrValue(data);
    // }
    else {
      nextNodeStatus = placeNodeStatus.UNKNOWN;
      // this.handleUnknown();
    }

    this.placeNodeStatus = nextNodeStatus;

    this.placeStorage.handleUpdateNode(this);

    // // 성공하지 못한 상태에서 성공 상태로 넘어갔을 경우에만 전파
    // if (isClear === true && this.isClear === false) {
    //   this.isClear = isClear;

    //   this.successor.handleThreCmdClear(this);
    // }
  }

  /**
   * @desc Place Node :::
   * @param {number} numDeviceData number 형식 데이터
   */
  updateNumValue(numDeviceData) {
    let nextPlaceNodeStatus = this.placeNodeStatus;
    // BU.CLI(deviceData, this.goalRange);
    if (_.isNumber(this.maxValue) && numDeviceData >= this.maxValue) {
      nextPlaceNodeStatus = placeNodeStatus.MAX_OVER;
      // this.handleMaxOver();
    } else if (_.isNumber(this.upperLimitValue) && numDeviceData >= this.upperLimitValue) {
      nextPlaceNodeStatus = placeNodeStatus.UPPER_LIMIT_OVER;
      // this.handleUpperLimitOver();
    } else if (_.isNumber(this.minValue) && numDeviceData <= this.minValue) {
      nextPlaceNodeStatus = placeNodeStatus.MIN_UNDER;
      // this.handleMinUnder();
    } else if (_.isNumber(this.lowerLimitValue) && numDeviceData <= this.lowerLimitValue) {
      nextPlaceNodeStatus = placeNodeStatus.LOWER_LIMIT_UNDER;
      // this.handleLowerLimitUnder();
    } else {
      nextPlaceNodeStatus = placeNodeStatus.NORMAL;
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
