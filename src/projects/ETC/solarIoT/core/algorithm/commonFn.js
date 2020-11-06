const _ = require('lodash');

const { BU } = require('base-util-jh');

const {
  constructorInfo,
  dcmConfigModel: {
    commandStep: cmdStep,
    goalDataRange: gDR,
    placeNodeStatus: pNS,
    reqWrapCmdFormat: reqWCF,
    reqWrapCmdType: reqWCT,
    reqDeviceControlType: reqDCT,
  },
} = require('../../../../../core/CoreFacade');

module.exports = {
  constructorInfo,

  /** Command Step */
  get cmdStep() {
    return cmdStep;
  },

  /** 데이터 목표 기준치 범위 */
  get gDR() {
    return gDR;
  },

  /** Place Node의 값에 따른 임계 상태 */
  get pNS() {
    return pNS;
  },

  /** 명령 요청 유형 */
  get reqWCF() {
    return reqWCF;
  },

  /** 명령 요청 타입 */
  get reqWCT() {
    return reqWCT;
  },

  /** 명령 제어 타입 */
  get reqDCT() {
    return reqDCT;
  },

  /** Node Definition Id  */
  get ndId() {
    return {
      BATTERY: 'percentBattery',
      RELAY: 'relay',
    };
  },

  get algorithmIdInfo() {
    return {
      DEFAULT: 'DEFAULT',
      AUTOMATION: 'AUTOMATION',
    };
  },

  get nodeDefIdInfo() {
    return {
      BATTERY: 'percentBattery',
      RELAY: 'relay',
    };
  },

  /**
   *
   * @param {PlaceNode} placeNode
   */
  getThresholdInfo(placeNode) {
    /** @type {mThresholdInfo} */
    let thresholdInfo = {};
    switch (placeNode.getNodeStatus()) {
      case pNS.MAX_OVER:
        thresholdInfo = placeNode.maxValue;
        break;
      case pNS.UPPER_LIMIT_OVER:
        thresholdInfo = placeNode.upperLimitValue;
        break;
      case pNS.NORMAL:
        thresholdInfo = placeNode.setValue;
        break;
      case pNS.LOWER_LIMIT_UNDER:
        thresholdInfo = placeNode.lowerLimitValue;
        break;
      case pNS.MIN_UNDER:
        thresholdInfo = placeNode.minValue;
        break;
      case pNS.UNKNOWN:
      case pNS.ERROR:
        thresholdInfo = {};
        break;
      default:
        thresholdInfo = {};
        break;
    }
    return thresholdInfo;
  },

  /**
   * 장소에 노드에 걸려있는 임계치를 가져옴
   * @param {PlaceStorage} placeStorage
   * @param {string} nodeDefId
   * @param {string=} placeNodeThreshold
   */
  getPlaceThresholdValue(placeStorage, nodeDefId, placeNodeThreshold) {
    let thresholdValue;
    switch (placeNodeThreshold) {
      case pNS.MAX_OVER:
        thresholdValue = placeStorage.getMaxValue(nodeDefId);
        break;
      case pNS.UPPER_LIMIT_OVER:
        thresholdValue = placeStorage.getUpperLimitValue(nodeDefId);
        break;
      case pNS.MIN_UNDER:
        thresholdValue = placeStorage.getMinValue(nodeDefId);
        break;
      case pNS.LOWER_LIMIT_UNDER:
        thresholdValue = placeStorage.getLowerLimitValue(nodeDefId);
        break;
      case pNS.NORMAL:
        thresholdValue = placeStorage.getSetValue(nodeDefId);
        break;
      default:
        thresholdValue = 0;
        break;
    }

    return thresholdValue;
  },

  /**
   * Place Node에 갱신 이벤트를 보내고자 할 경우
   * @param {CoreFacade} coreFacade
   * @param {string} placeId Node Definition ID, 없을 경우 전체 갱신
   */
  emitReloadPlaceStorage(coreFacade, placeId) {
    // BU.CLI('emitReloadPlaceStorage', placeId);
    coreFacade.reloadPlaceStorage(placeId, [this.ndId.BATTERY]);
  },
};
