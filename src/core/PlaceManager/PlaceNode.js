const _ = require('lodash');

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
      callPlaceRankList,
      putPlaceRankList,
    } = thresholdConfigInfo;

    /** @type {ThresholdAlgorithm} */
    this.threAlogo;
  }

  /**
   * 현 Place Node 객체를 가지는 Place Storage 객체
   * @param {PlaceComponent} placeComponent
   */
  setPlace(placeComponent) {
    this.place = placeComponent;
  }

  /**
   * 임계 알고리즘을 수행할 객체 정의
   * @param {ThresholdAlgorithm} thresholdAlgorithm
   */
  setThresholdAlgorithm(thresholdAlgorithm) {
    this.threAlogo = thresholdAlgorithm;
  }

  /**
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
      this.threAlogo.handleError();
    }

    // // 성공하지 못한 상태에서 성공 상태로 넘어갔을 경우에만 전파
    // if (isClear === true && this.isClear === false) {
    //   this.isClear = isClear;

    //   this.successor.handleThreCmdClear(this);
    // }
  }

  /**
   * @param {number} numDeviceData number 형식 데이터
   */
  updateNumValue(numDeviceData) {
    // BU.CLI(deviceData, this.goalRange);
    const isClear = false;

    if (_.isNumber(this.maxValue) && numDeviceData >= this.maxValue) {
      this.threAlogo.handleMaxOver(this);
    } else if (_.isNumber(this.upperLimitValue) && numDeviceData >= this.upperLimitValue) {
      this.threAlogo.handleUpperLimitOver(this);
    } else if (_.isNumber(this.minValue) && numDeviceData <= this.minValue) {
      this.threAlogo.handleMinUnder(this);
    } else if (_.isNumber(this.lowerLimitValue) && numDeviceData <= this.lowerLimitValue) {
      this.threAlogo.handleLowerLimitUnder(this);
    } else {
      this.threAlogo.handleNormal(this);
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
}
module.exports = PlaceNode;
