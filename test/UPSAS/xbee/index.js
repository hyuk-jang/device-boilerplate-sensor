require('dotenv').config();
const _ = require('lodash');
const { BU } = require('base-util-jh');
const config = require('./config');
const Main = require('../../../src/Main');

process.env.NODE_ENV = 'development';

const { dbInfo } = config;

BU.CLI(dbInfo);

const main = new Main();
// const control = main.createControl({
//   dbInfo: config.dbInfo,
// });
const control = main.createControl(config);
// control.init();
control
  .init(dbInfo, config.uuid)
  .then(() => {
    BU.CLI('start Program');
    // control.runFeature();
    // control.inquiryAllDeviceStatus();
    // control.runDeviceInquiryScheduler();
  })
  .catch(err => {
    BU.CLI(err);
  });

process.on('uncaughtException', err => {
  // BU.debugConsole();
  console.error(err.stack);
  console.log(err.message);
  console.log('Node NOT Exiting...');
});

process.on('unhandledRejection', err => {
  // BU.debugConsole();
  BU.CLI(err);
  console.log('Node NOT Exiting...');
});
