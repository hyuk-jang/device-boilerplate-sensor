const { BM } = require('base-model-jh');

class AbstBlockManager {
  /** @param {MainControl} controller */
  constructor(controller) {
    this.controller = controller;

    /** @type {dataContainerDBS[]} */
    this.dataContainerList = [];

    this.hasSaveToDB = true;
  }

  /**
   *
   * @param {dbInfo} dbInfo
   * @param {blockConfig[]} blockConfigList
   */
  async init(dbInfo, blockConfigList) {
    // DB Connector 설정 (현재 mysql만 되어 있음.)
    this.setDbConnector(dbInfo);
    // 블록 정보를 기반으로 DB Table을 접근하여 dataContainer를 설정
    await this.setBlockTable(blockConfigList);
    // DBS에 연결된 장소 목록을 dataContainer
    this.bindingPlaceList(this.controller.placeList);
  }

  /**
   *
   * @param {boolean} hasSaveToDB
   */
  setHasSaveToDB(hasSaveToDB) {
    this.hasSaveToDB = hasSaveToDB;
  }

  /**
   * DB에 저장할 Connector를 생성하기 위한 정보
   * @param {dbInfo} dbInfo
   */
  setDbConnector(dbInfo) {
    console.log('setDbConnector', dbInfo);
    this.biModule = new BM(dbInfo);
  }

  /**
   * @desc only DBS.
   * Device Client 추가
   * @param {blockConfig[]} blockConfigList
   * @return {dataContainerDBS[]}
   */
  async setBlockTable(blockConfigList) {}

  /**
   * @desc only DBS.
   * dataContainer과 연관이 있는 place Node List를 세팅함.
   * @param {placeInfo[]} placeList
   */
  bindingPlaceList(placeList) {}

  /**
   * 지정한 카테고리의 모든 데이터를 순회하면서 db에 적용할 데이터를 정제함.
   * @param {string} deviceCategory  장치 Type 'inverter', 'connector'
   * @param {Date=} processingDate 해당 카테고리를 DB에 처리한 시각. insertData에 저장이 됨
   * @param {boolean} hasIgnoreError 에러를 무시하고 insertData 구문을 실애할 지 여부. default: false
   * @return {dataContainerDBS}
   */
  async refineDataContainer(deviceCategory, processingDate, hasIgnoreError) {}

  /**
   * DB에 컨테이너 단위로 저장된 insertDataList, insertTroubleList, updateTroubleList를 적용
   * @param {string} deviceCategory 카테고리 명
   * @return {dataContainerDBS}
   */
  async saveDataToDB(deviceCategory) {}

  /**
   * 장치 저장소 카테고리에 맞는 타입을 가져옴
   * @param {string} blockCategory 저장소 카테고리 'inverter', 'connector' ... etc
   * @return {dataContainerDBS}
   */
  getDataContainer(blockCategory) {}
}
module.exports = AbstBlockManager;
