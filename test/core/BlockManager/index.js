require('dotenv').config();

const Promise = require('bluebird');
const eventToPromise = require('event-to-promise');

const { expect } = require('chai');
const { BU } = require('base-util-jh');

const blockConfig = require('./block.config.js');

const Main = require('../../../src/Main');
const config = require('../../../src/config');

const BlockManager = require('../../../src/features/BlockManager/BlockManager');

const dbInfo = {
  host: process.env.WEB_DB_HOST,
  database: process.env.WEB_DB_DB,
  port: process.env.WEB_DB_PORT,
  user: process.env.WEB_DB_USER,
  password: process.env.WEB_DB_PW,
};

// TEST: DBS 테스트
// 1. DB 접속 정보(mysql)를 바탕으로 dataContainer를 구성.
// 2. 가상 placeList를 바탕으로 dataStorage 단위로 nodeInfo 를 붙임.
// 3. Echo Server와의 통신을 통한 node 데이터를 생성하고. 데이터 정제 테스트

async function testManager() {
  BU.CLI('testManager');

  // 2. 가상 placeList를 바탕으로 dataStorage 단위로 nodeInfo 를 붙임.
  const main = new Main();
  const controller = main.createControl({
    projectInfo: {
      projectMainId: 'UPSAS',
      projectSubId: 'muan',
    },
  });

  await controller.getDataLoggerListByDB(dbInfo);
  BU.CLI('Tru controller init Complete');

  await controller.init();

  BU.CLI('controller init Complete');
  console.time('blockInit');
  const blockManager = new BlockManager(controller);
  // // Block Table 설정 옵션
  await blockManager.init(dbInfo, blockConfig);
  console.timeEnd('blockInit');

  if (!blockManager.dataContainerList.length) {
    throw new Error('컨테이너가 없습니다.');
  }

  controller.inquiryAllDeviceStatus();

  await eventToPromise(controller, 'completeInquiryAllDeviceStatus');

  console.time('refineDataContainer');
  await blockManager.refineDataContainer('inverter');
  console.timeEnd('refineDataContainer');

  console.time('saveDataToDB');
  await blockManager.saveDataToDB('inverter');
  console.timeEnd('saveDataToDB');

  BU.CLI('complete All');
}

testManager();
