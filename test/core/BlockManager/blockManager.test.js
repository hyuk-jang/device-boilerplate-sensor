require('dotenv').config();

const ENV = process.env;

const Promise = require('bluebird');
const eventToPromise = require('event-to-promise');

const { expect } = require('chai');
const { BU } = require('base-util-jh');

const blockConfig = require('./block.config.js');

const Main = require('../../../src/Main');
const config = require('../../../src/config');

const BlockManager = require('../../../src/features/BlockManager/BlockManager');

const dbInfo = {
  port: ENV.PJ_DB_PORT || '3306',
  host: ENV.PJ_DB_HOST || 'localhost',
  user: ENV.PJ_DB_USER || 'root',
  password: ENV.PJ_DB_PW || 'test',
  database: ENV.PJ_DB_DB || 'test',
};

describe('Step 1', () => {
  // TEST: DBS 테스트
  // 1. DB 접속 정보(mysql)를 바탕으로 dataContainer를 구성.
  // 2. 가상 placeList를 바탕으로 dataStorage 단위로 nodeInfo 를 붙임.
  // 3. Echo Server와의 통신을 통한 node 데이터를 생성하고. 데이터 정제 테스트
  it.only('setDeviceForDB', async () => {
    // 2. 가상 placeList를 바탕으로 dataStorage 단위로 nodeInfo 를 붙임.
    const main = new Main();
    const controller = main.createControl({
      projectInfo: {
        projectMainId: 'UPSAS',
        projectSubId: 'muan',
      },
    });

    await controller.init(dbInfo);

    const blockManager = new BlockManager();

    // 1. DB 접속 정보(mysql)를 바탕으로 dataContainer를 구성.
    await blockManager.setDbConnector(dbInfo);

    const dataStorageList = await blockManager.setBlockTable(blockConfig);

    expect(dataStorageList.length).to.eq(1);
    // Init 구현 테스트
    blockManager.bindingPlaceList(controller.placeList);

    BU.CLIN(blockManager.dataContainerList);

    expect(dataStorageList[0].dataStorageList[0].nodeList.length).to.not.eq(0);

    blockManager.refineDataContainer('inverter');
  });

  it('bindingPlaceList', async () => {});
});
