const _ = require('lodash');
const { BU, CU } = require('base-util-jh');
const { BM } = require('base-model-jh');

const Control = require('../../../Control');

const ApiClient = require('../../../features/ApiCommunicator/ApiClient');
const MuanScenario = require('./MuanScenario');
const PBS = require('../../../features/PowerStatusBoard/PBS');

class MuanControl extends Control {
  // /** @param {integratedDataLoggerConfig} config */
  // constructor(config) {
  //   super(config);
  // }

  bindingFeature() {
    // return super.bindingFeature();
    BU.CLI('bindingFeature');
    // super.bindingFeature();
    // const test = new DefaultApiClient(this);
    /** @type {DefaultApiClient} */
    this.apiClient = new ApiClient(this);

    /** @type {MuanScenario} */
    this.scenarioManager = new MuanScenario(this);

    /** @type {PBS} */
    this.powerStatusBoard = new PBS(this);
  }

  /**
   * 생성된 Feature를 구동시킴
   * @param {dbsFeatureConfig} featureConfig
   */
  runFeature(featureConfig) {
    BU.CLI(featureConfig);
    const { apiConfig, powerStatusBoardConfig } = featureConfig;
    this.apiClient.connect({
      controlInfo: {
        hasReconnect: true,
      },
      connect_info: apiConfig,
    });

    // 현황판 접속
    this.powerStatusBoard.connect({
      controlInfo: {
        hasReconnect: true,
      },
      connect_info: powerStatusBoardConfig,
    });
  }

  initMakeConfigForDLC() {
    // 리스트 돌면서 데이터 로거에 속해있는 Node를 세팅함
    this.config.dataLoggerList = this.dataLoggerList.map(dataLoggerInfo => {
      const {
        data_logger_seq: seqDL,
        connect_info: connectInfo = {},
        protocol_info = {},
      } = dataLoggerInfo;

      const foundNodeList = _.filter(this.nodeList, nodeInfo => nodeInfo.data_logger_seq === seqDL);

      // FIXME: TEST 로 사용됨  -------------
      /** @type {connect_info} */
      const connInfo = JSON.parse(connectInfo);
      if (connInfo.type === 'zigbee') {
        connInfo.type = 'socket';
        connInfo.subType = 'parser';
        connInfo.port = 9000;
        connInfo.addConfigInfo = {
          parser: 'delimiterParser',
          option: '}}',
        };
      } else if (connInfo.type === 'serial' && connInfo.subType === 'parser') {
        connInfo.type = 'socket';
        connInfo.port = 9001;
        connInfo.subType = '';
        delete connInfo.addConfigInfo;
      } else if (connInfo.type === 'serial' && connInfo.subType === '') {
        connInfo.type = 'socket';
        connInfo.port = 9002;
      }

      // FIXME: TEST 로 사용됨  -------------

      // 환경 정보가 strJson이라면 변환하여 저장
      _.set(dataLoggerInfo, 'connect_info', connInfo);

      BU.IsJsonString(protocol_info) &&
        _.set(dataLoggerInfo, 'protocol_info', JSON.parse(protocol_info));

      /** @type {dataLoggerConfig} */
      const loggerConfig = {
        hasDev: false,
        dataLoggerInfo,
        nodeList: foundNodeList,
        deviceInfo: {},
      };

      return loggerConfig;
    });
  }
}
module.exports = MuanControl;
