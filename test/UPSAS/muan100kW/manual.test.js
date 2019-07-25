/* eslint-disable camelcase */
require('dotenv').config();
const _ = require('lodash');
const Promise = require('bluebird');
const { expect } = require('chai');

const eventToPromise = require('event-to-promise');

const { BU } = require('base-util-jh');
const config = require('./config');
const Main = require('../../../src/Main');
const CoreFacade = require('../../../src/core/CoreFacade');

const {
  dcmConfigModel: {
    complexCmdStep,
    reqWrapCmdType: reqWCT,
    reqDeviceControlType: { TRUE, FALSE, SET, MEASURE },
  },
} = CoreFacade;

const ThreCmdComponent = require('../../../src/core/CommandManager/Command/ThresholdCommand/ThreCmdComponent');

const { goalDataRange } = ThreCmdComponent;

process.env.NODE_ENV = 'development';

const { dbInfo } = config;

const main = new Main();
// const control = main.createControl({
//   dbInfo: config.dbInfo,
// });
const control = main.createControl(config);
const coreFacade = new CoreFacade();

const ndId = {
  S: 'salinity',
  WL: 'waterLevel',
  BT: 'brineTemperature',
  MRT: 'moduleRearTemperature',
};

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
  BW_1: 'BW_1',
  BW_2: 'BW_2',
  BW_3: 'BW_3',
  BW_4: 'BW_4',
  BW_5: 'BW_5',
};

/** 제어 모드 */
const controlMode = {
  MANUAL: 'MANUAL',
  POWER_OPTIMIZATION: 'POWER_OPTIMIZATION',
  SALTERN_POWER_OPTIMIZATION: 'SALTERN_POWER_OPTIMIZATION',
  RAIN: 'RAIN',
};

/**
 *
 * @param {PlaceNode} placeNode
 * @param {*} setValue
 */
function setNodeData(placeNode, setValue) {
  _.set(placeNode, 'nodeInfo.data', setValue);

  return _.get(placeNode, 'nodeInfo');
}

describe('수동 테스트', function() {
  this.timeout(5000);

  before(async () => {
    await control.init(dbInfo, config.uuid);
    control.runFeature();

    coreFacade.updateControlMode(controlMode.MANUAL);

    control.inquiryAllDeviceStatus();
    await eventToPromise(control, 'completeInquiryAllDeviceStatus');
  });

  beforeEach(async () => {
    try {
      control.executeSetControl({
        wrapCmdId: 'closeAllDevice',
        wrapCmdType: reqWCT.CONTROL,
      });
      await eventToPromise(control, 'completeCommand');
    } catch (error) {
      BU.error(error.message);
    }
  });

  it('구동 테스트', () => {});
});
