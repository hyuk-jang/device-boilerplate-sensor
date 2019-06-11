const _ = require('lodash');

const { BU } = require('base-util-jh');

const PlaceComponent = require('./PlaceComponent');
const ThresholdAlgorithm = require('./ThresholdAlgorithm');

const {
  dcmConfigModel: { goalDataRange },
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
  }

  /**
   * @desc Place Node :::
   * Node Id 반환
   */
  getNodeId() {
    return this.nodeInfo.node_id;
  }

  /**
   * @desc Place Node :::
   * 현 Place Node 객체를 가지는 Place Storage 객체
   * @param {PlaceComponent} placeComponent
   */
  setPlace(placeComponent) {
    this.placeStorage = placeComponent;
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

    let isClear = false;

    if (_.isNumber(data)) {
      isClear = this.updateNumValue(data);
    } else if (_.isString(data)) {
      isClear = this.updateStrValue(data);
    } else {
      this.handleUnknown();
    }

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
    // BU.CLI(deviceData, this.goalRange);
    const isClear = false;

    if (_.isNumber(this.maxValue) && numDeviceData >= this.maxValue) {
      this.handleMaxOver();
    } else if (_.isNumber(this.upperLimitValue) && numDeviceData >= this.upperLimitValue) {
      this.handleUpperLimitOver();
    } else if (_.isNumber(this.minValue) && numDeviceData <= this.minValue) {
      this.handleMinUnder();
    } else if (_.isNumber(this.lowerLimitValue) && numDeviceData <= this.lowerLimitValue) {
      this.handleLowerLimitUnder();
    } else {
      this.handleNormal();
    }

    return isClear;
  }

  // /**
  //  * @param {string} deviceData string 형식 데이터
  //  */
  // updateStrValue(deviceData) {
  //   // 문자 데이터일 경우에는 달성 목표가 EQUAL이어야만 함. 문자 상하 비교 불가
  //   if (this.goalRange !== goalDataRange.EQUAL) return false;

  //   // 대소 문자의 차이가 있을 수 있으므로 소문자로 변환 후 비교
  //   return _.lowerCase(deviceData) === _.lowerCase(this.goalValue);
  // }

  /** 장치 상태가 식별 불가 일 경우 */
  handleUnknown() {
    this.placeStorage.handleUnknown(this);
  }

  /** 장치 상태가 에러일 경우 */
  handleError() {
    this.placeStorage.handleError(this);
  }

  /** Node 임계치가 최대치를 넘을 경우 */
  handleMaxOver() {
    this.placeStorage.handleMaxOver(this);
  }

  /** Node 임계치가 상한선을 넘을 경우 */
  handleUpperLimitOver() {
    this.placeStorage.handleUpperLimitOver(this);
  }

  /** Node 임계치가 정상 일 경우 */
  handleNormal() {
    this.placeStorage.handleNormal(this);
  }

  /** Node 임계치가 하한선에 못 미칠 경우 */
  handleLowerLimitUnder() {
    this.placeStorage.handleLowerLimitUnder(this);
  }

  /** Node 임계치가 최저치에 못 미칠 경우 */
  handleMinUnder() {
    this.placeStorage.handleMinUnder(this);
  }
}
module.exports = PlaceNode;
