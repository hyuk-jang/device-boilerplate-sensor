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

const { dcmConfigModel } = CoreFacade;

const {
  commandStep: cmdStep,
  goalDataRange: goalDR,
  reqWrapCmdType: reqWCT,
  reqWrapCmdFormat: reqWCF,
  reqDeviceControlType: { TRUE, FALSE, SET, MEASURE },
} = dcmConfigModel;

process.env.NODE_ENV = 'development';

const { dbInfo } = config;

const main = new Main();
// const control = main.createControl({
//   dbInfo: config.dbInfo,
// });
const control = main.createControl(config);

describe('수동 테스트', function() {
  this.timeout(5000);

  before(async () => {
    await control.init(dbInfo, config.uuid);
    control.runFeature();

    control.inquiryAllDeviceStatus();

    await eventToPromise(control, cmdStep.COMPLETE);
  });

  // beforeEach(async () => {
  //   try {
  //     control.executeSetControl({
  //       wrapCmdId: 'closeAllDevice',
  //       wrapCmdType: reqWCT.CONTROL,
  //     });
  //     await eventToPromise(control, cmdStep.COMPLETE);
  //   } catch (error) {
  //     BU.error(error.message);
  //   }
  // });

  it('구동 테스트', () => {});
});
