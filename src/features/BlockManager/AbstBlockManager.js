const { BM } = require('base-model-jh');

class AbstBlockManager {
  /** @param {MainControl} controller */
  constructor(controller) {
    this.controller = controller;

    /** @type {dataContainerDBS[]} */
    this.dataContainerList = [];

    this.isSaveToDB = true;
  }

  /**
   *
   * @param {dbInfo} dbInfo
   * @param {blockConfig[]} blockConfigList
   */
  async init(dbInfo, blockConfigList) {
    if (process.env.DBS_SAVE_BLOCK === '0') {
      this.isSaveToDB = false;
    }
    // DB Connector 설정 (현재 mysql만 되어 있음.)
    this.setDbConnector(dbInfo);
    // 블록 정보를 기반으로 DB Table을 접근하여 dataContainer를 설정
    await this.setBlockTable(blockConfigList);
    // DBS에 연결된 장소 목록을 dataContainer
    this.bindingPlaceList(this.controller.placeList);
  }

  /**
   *
   * @param {boolean} isSaveDB
   */
  setIsSaveToDB(isSaveDB) {
    this.isSaveToDB = isSaveDB;
  }

  /**
   * DB에 저장할 Connector를 생성하기 위한 정보
   * @param {dbInfo} dbInfo
   */
  setDbConnector(dbInfo) {
    this.biModule = new BM(dbInfo);
  }

  /**
   * @desc only DBS.
   * Device Client 추가
   * @param {blockConfig[]} blockConfigList
   * @return {Promise.<dataContainerDBS[]>}
   */
  setBlockTable(blockConfigList) {}

  /**
   * @desc only DBS.
   * dataContainer과 연관이 있는 place Node List를 세팅함.
   * @param {placeInfo[]} placeList
   */
  bindingPlaceList(placeList) {}

  /**
   * 지정한 카테고리의 모든 데이터를 순회하면서 db에 적용할 데이터를 정제함.
   * @param {string} blockCategory  장치 Type 'inverter', 'connector'
   * @param {Date=} refineDate 해당 카테고리를 정제한 시각. insertData에 저장이 됨
   * @return {Promise.<dataContainerDBS>}
   */
  refineDataContainer(blockCategory, refineDate = new Date()) {}

  /**
   * DB에 컨테이너 단위로 저장된 insertDataList, insertTroubleList, updateTroubleList를 적용
   * @param {string} blockCategory 카테고리 명
   * @return {Promise.<dataContainerDBS>}
   */
  saveDataToDB(blockCategory) {}

  /**
   * 장치 저장소 카테고리에 맞는 타입을 가져옴
   * @param {string} blockCategory 저장소 카테고리 'inverter', 'connector' ... etc
   * @return {dataContainerDBS}
   */
  getDataContainer(blockCategory) {}
}
module.exports = AbstBlockManager;
