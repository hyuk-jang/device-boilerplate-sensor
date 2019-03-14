require('dotenv').config();

const _ = require('lodash');

const Promise = require('bluebird');
const eventToPromise = require('event-to-promise');

const { BU } = require('base-util-jh');

const blockConfig = require('./block.config.js');

const Main = require('../../../src/Main');
const config = require('../../../src/config');

const { dbInfo } = config;

const BlockManager = require('../../../src/features/BlockManager/BlockManager');

BU.CLI(config);

// TEST: DBS 테스트
// 1. DB 접속 정보(mysql)를 바탕으로 dataContainer를 구성.
// 2. 가상 placeList를 바탕으로 dataStorage 단위로 nodeInfo 를 붙임.
// 3. Echo Server와의 통신을 통한 node 데이터를 생성하고. 데이터 정제 테스트

async function testManager() {
  BU.CLI('testManager');

  try {
    // 2. 가상 placeList를 바탕으로 dataStorage 단위로 nodeInfo 를 붙임.
    const main = new Main();
    const controller = main.createControl(config);

    BU.CLI(controller.Model);

    await controller.init(dbInfo);
    BU.CLI('Tru controller init Complete');

    BU.CLIN(_.head(controller.nodeList));

    // 생성된 기능들 활성화
    // controller.runFeature(config.projectInfo.featureConfig);

    BU.CLI('controller init Complete');
    console.time('blockInit');
    const blockManager = new BlockManager(controller);
    // // Block Table 설정 옵션
    await blockManager.init(dbInfo, blockConfig);
    console.timeEnd('blockInit');

    controller.blockManager = blockManager;

    if (!blockManager.dataContainerList.length) {
      throw new Error('컨테이너가 없습니다.');
    }

    controller.inquiryAllDeviceStatus();
    // controller.runDeviceInquiryScheduler();

    await eventToPromise(controller, 'completeInquiryAllDeviceStatus');

    console.time('refineDataContainer');
    await blockManager.refineDataContainer('inverter');
    console.timeEnd('refineDataContainer');

    console.time('saveDataToDB');
    await blockManager.saveDataToDB('inverter');
    console.timeEnd('saveDataToDB');

    BU.CLI('complete All');
  } catch (error) {
    BU.CLI(error);
  }
}

testManager();
