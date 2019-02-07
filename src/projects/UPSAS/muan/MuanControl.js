const _ = require('lodash');
const { BU, CU } = require('base-util-jh');
const { BM } = require('base-model-jh');

const Control = require('../../../Control');

const ApiClient = require('../../../features/ApiCommunicator/ApiClient');
const MuanScenario = require('./MuanScenario');
const PBS = require('../../../features/PowerStatusBoard/PBS');
const BlockManager = require('../../../features/BlockManager/BlockManager');

const blockConfig = require('./block.config');

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

    /** @type {BlockManager} */
    this.blockManager = new BlockManager(this);

    this.bindingEventHandler();
  }

  /**
   * @override
   * 생성된 Feature를 구동시킴
   * @param {dbsFeatureConfig} featureConfig
   */
  async runFeature(featureConfig = _.get(this, 'config.projectInfo.featureConfig', {})) {
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

    await this.blockManager.init(this.config.dbInfo, blockConfig);
  }

  /**
   * @override
   * @desc init Step: 2
   * this.dataLoggerList 목록을 돌면서 DLC 객체를 생성하기 위한 설정 정보 생성
   */
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

  bindingEventHandler() {
    this.on('completeInquiryAllDeviceStatus', err => {
      this.blockManager
        .refineDataContainer('inverter')
        .then(() => this.blockManager.saveDataToDB('inverter'));
    });
  }
}
module.exports = MuanControl;
