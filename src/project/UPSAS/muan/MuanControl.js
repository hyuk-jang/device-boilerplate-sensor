const { BU, CU } = require('base-util-jh');

const Control = require('../../../Control');

const DefaultApiClient = require('../../../Feature/ApiCommunicator/DefaultApiClient');
const MuanScenario = require('./MuanScenario');
const DefaultPBS = require('../../../Feature/PowerStatusBoard/DefaultPBS');

class MuanControl extends Control {
  // /** @param {integratedDataLoggerConfig} config */
  // constructor(config) {
  //   super(config);
  // }

  bindingFeature() {
    BU.CLI('bindingFeature');
    // super.bindingFeature();
    // const test = new DefaultApiClient(this);
    /** @type {DefaultApiClient} */
    this.apiClient = new DefaultApiClient(this);
    this.apiClient.connect({
      connect_info: this.config.mainSocketInfo,
    });
    // this.apiClient.connect(this.config.mainSocketInfo);

    /** @type {MuanScenario} */
    this.scenarioManager = new MuanScenario(this);

    /** @type {DefaultPBS} */
    this.powerStatusBoard = new DefaultPBS(this);
    this.powerStatusBoard.connect({
      connect_info: this.config.powerStatusBoardInfo,
    });
    this.powerStatusBoard.connect(this.config.powerStatusBoardInfo);

    // this.apiClient.doConnect(this.config.powerStatusBoardInfo);
  }

  test() {}
}
module.exports = MuanControl;
