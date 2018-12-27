const { BU, CU } = require('base-util-jh');

const Control = require('../../../Control');

const DefaultApiClient = require('../../../features/ApiCommunicator/DefaultApiClient');
const MuanScenario = require('./MuanScenario');
const DefaultPBS = require('../../../features/PowerStatusBoard/DefaultPBS');

class MuanControl extends Control {
  // /** @param {integratedDataLoggerConfig} config */
  // constructor(config) {
  //   super(config);
  // }

  bindingFeature() {
    return super.bindingFeature();
    BU.CLI('bindingFeature');
    // super.bindingFeature();
    // const test = new DefaultApiClient(this);
    /** @type {DefaultApiClient} */
    this.apiClient = new DefaultApiClient(this);
    this.apiClient.connect({
      controlInfo: {
        hasReconnect: true,
      },
      connect_info: this.config.mainSocketInfo,
    });
    // this.apiClient.connect(this.config.mainSocketInfo);

    /** @type {MuanScenario} */
    this.scenarioManager = new MuanScenario(this);

    /** @type {DefaultPBS} */
    this.powerStatusBoard = new DefaultPBS(this);
    this.powerStatusBoard.connect({
      controlInfo: {
        hasReconnect: true,
      },
      connect_info: this.config.powerStatusBoardInfo,
    });
  }

  test() {}
}
module.exports = MuanControl;
