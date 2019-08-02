const _ = require('lodash');

/** 장치 제어 타입 */
const reqDCT = {
  /** 장치 Close, Off */
  FALSE: 0,
  /** 장치 Open, On */
  TRUE: 1,
  /** 장치 Measure */
  MEASURE: 2,
  /** 장치 값 설정 */
  SET: 3,
};

const ndId = {
  S: 'salinity',
  WL: 'waterLevel',
  BT: 'brineTemperature',
  MRT: 'moduleRearTemperature',
};
exports.ndId = ndId;

const pId = {
  RV_1: 'RV_1',
  RV_2: 'RV_2',
  SEA: 'SEA',
  NEB_1: 'NEB_1',
  NEB_2: 'NEB_2',
  NCB: 'NCB',
  SEB_1: 'SEB_1',
  SEB_2: 'SEB_2',
  SEB_3: 'SEB_3',
  SEB_4: 'SEB_4',
  SEB_5: 'SEB_5',
  SEB_6: 'SEB_6',
  SEB_7: 'SEB_7',
  SEB_8: 'SEB_8',
  SEB_ONE: 'SEB_ONE',
  SEB_TWO: 'SEB_TWO',
  BW_1: 'BW_1',
  BW_2: 'BW_2',
  BW_3: 'BW_3',
  BW_4: 'BW_4',
  BW_5: 'BW_5',
};
exports.pId = pId;

/** 제어 모드 */
const controlMode = {
  MANUAL: 'MANUAL',
  POWER_OPTIMIZATION: 'POWER_OPTIMIZATION',
  SALTERN_POWER_OPTIMIZATION: 'SALTERN_POWER_OPTIMIZATION',
  SCENARIO: 'SCENARIO',
};
exports.controlMode = controlMode;

const sConV = {
  TRUE: { singleControlType: reqDCT.TRUE },
  REAL_TRUE: { singleControlType: reqDCT.TRUE, isIgnore: false },
  IGNORE_TRUE: { singleControlType: reqDCT.TRUE, isIgnore: true },
  FALSE: { singleControlType: reqDCT.FALSE },
  REAL_FALSE: { singleControlType: reqDCT.FALSE, isIgnore: false },
  IGNORE_FALSE: { singleControlType: reqDCT.FALSE, isIgnore: true },
};
exports.sConV = sConV;

/**
 *
 * @param {PlaceNode} placeNode
 * @param {*} setValue
 */
function setNodeData(placeNode, setValue) {
  _.set(placeNode, 'nodeInfo.data', setValue);

  return _.get(placeNode, 'nodeInfo');
}
exports.setNodeData = setNodeData;

/**
 * cmdStorage 내의 cmdElements nodeId 목록 반환
 * @param {cmdStorage} cmdStorage
 * @param {cmdElementSearch} cmdEleSearchInfo
 */
function getNodeIds(cmdStorage, cmdEleSearchInfo) {
  return cmdStorage.getCmdEleList(cmdEleSearchInfo).map(cmdEle => cmdEle.nodeId);
}

exports.getNodeIds = getNodeIds;

/**
 * 간단한 cmdStorage 내의 cmdElements 정보 반환
 * @param {CmdStorage} cmdStorage
 */
function getSimpleCmdElementsInfo(cmdStorage) {
  return _.map(cmdStorage.getCmdEleList(), cmdEle => {
    return {
      nodeId: cmdEle.nodeId,
      isIgnore: cmdEle.isIgnore,
      singleControlType: cmdEle.singleControlType,
      cmdEleStep: cmdEle.cmdEleStep,
    };
  });
}
exports.getSimpleCmdElementsInfo = getSimpleCmdElementsInfo;

/**
 * 기존 명령 객체 클론.
 * 요청 명령의 Wrap Cmd Type을 CANCEL 로 교체하여 반환
 * @param {reqFlowCmdInfo} reqFlowCmdInfo
 */
function convertConToCan(reqFlowCmdInfo) {
  return _.chain(reqFlowCmdInfo)
    .clone()
    .set('wrapCmdType', 'CANCEL')
    .value();
}
exports.convertConToCan = convertConToCan;

function updateNode(control, isDelay = true) {
  const controller = control;
  return function(...nodeList) {
    if (isDelay) {
      // 지연 명령으로 하단에 await cmdStep을 기다릴 경우 사용
      setImmediate(() => controller.notifyDeviceData(null, nodeList));
    } else {
      controller.notifyDeviceData(null, nodeList);
    }
  };
}
exports.updateNode = updateNode;

function updatePlace(control, isDelay = true) {
  const controller = control;
  return function(...nodeSetList) {
    const nodeList = nodeSetList.map(setNodeInfo => {
      return setNodeData(...setNodeInfo);
    });
    if (isDelay) {
      // 지연 명령으로 하단에 await cmdStep을 기다릴 경우 사용
      setImmediate(() => controller.notifyDeviceData(null, nodeList));
    } else {
      controller.notifyDeviceData(null, nodeList);
    }
  };
}
exports.updatePlace = updatePlace;
