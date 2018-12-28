const DeviceClientModel = require('../../../../device-client-model-jh');

class AbstBlockManager {
  /** @param {MainControl} controller */
  constructor(controller) {
    this.controller = controller;

    this.deviceClientModel = new DeviceClientModel();
  }

  init() {}

  // TODO: DB Table을 참조하여 DCM 저장소 초기화

  /**
   *
   * @param {Object} dcmConstructorInfo
   * @param {string} dbTableName 참조할 DB Table 명
   * @param {string} idKey DB Table에서 ID로 사용할 컬럼 명. DCM Storage 관리 ID로 사용 됨.
   * @param {string} category DCM 저장소에서 관리할 Category 명.
   */
  async setDeviceClientModel(dcmConstructorInfo) {}
}
module.exports = AbstBlockManager;
