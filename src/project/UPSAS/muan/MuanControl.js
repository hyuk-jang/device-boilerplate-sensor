const { BU, CU } = require('base-util-jh');

const Control = require('../../../Control');

const DefaultApiClient = require('../../../Feature/ApiCommunicator/DefaultApiClient');

class MuanControl extends Control {
  // /** @param {integratedDataLoggerConfig} config */
  // constructor(config) {
  //   super(config);
  // }

  setOptionFeature() {
    BU.CLI('setOptionFeature');
    super.setOptionFeature();

    this.apiClient = new DefaultApiClient(this);

    // this.apiClient.doConnect(this.config.powerStatusBoardInfo);
  }
}
module.exports = MuanControl;
