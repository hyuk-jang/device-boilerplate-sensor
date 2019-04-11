const _ = require('lodash');
const { BU, CU } = require('base-util-jh');
const { BM } = require('base-model-jh');

const Control = require('../../../Control');

const ApiClient = require('../../../features/ApiCommunicator/ApiClient');
const MuanScenario = require('./MuanScenario');
const PBS = require('../../../features/PowerStatusBoard/PBS');
const BlockManager = require('../../../features/BlockManager/BlockManager');

const blockConfig = require('./block.config');

const CriticalSetter = require('../smartSalternCore/CriticalSetter');

const SmartSalternStorage = require('../smartSalternCore/SmartSalternStorage');

class MuanControl extends Control {
  // /** @param {integratedDataLoggerConfig} config */
  // constructor(config) {
  //   super(config);
  // }

  bindingFeature() {
    // return super.bindingFeature();
    // BU.CLI('bindingFeature');
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

    const criticalSetter = new CriticalSetter(this);

    criticalSetter.init();

    BU.CLIN(this.placeList);

    // this.smartSalternStorage = new SmartSalternStorage(this);
    // this.smartSalternStorage.init();

    this.bindingEventHandler();
  }

  /**
   * @override
   * 생성된 Feature를 구동시킴
   * @param {dbsFeatureConfig} featureConfig
   */
  async runFeature(featureConfig = _.get(this, 'config.projectInfo.featureConfig', {})) {
    // BU.CLI(featureConfig);

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
    // return super.initMakeConfigForDLC();
    // 리스트 돌면서 데이터 로거에 속해있는 Node를 세팅함
    this.config.dataLoggerList = this.dataLoggerList.map(dataLoggerInfo => {
      const {
        data_logger_seq: seqDL,
        connect_info: connectInfo = {},
        protocol_info: protocolInfo = {},
      } = dataLoggerInfo;

      const foundNodeList = _.filter(this.nodeList, nodeInfo => nodeInfo.data_logger_seq === seqDL);

      /** @type {connect_info} */
      let connInfo = JSON.parse(connectInfo);
      /** @type {protocol_info} */
      const protoInfo = JSON.parse(protocolInfo);

      // 장치 id가 Buffer 타입이라면 Buffer로 변환 후 strnig 으로 변환
      if (protoInfo.deviceId && protoInfo.deviceId.type === 'Buffer') {
        protoInfo.deviceId = Buffer.from(protoInfo.deviceId.data).toString();
      }

      // FIXME: TEST 로 사용됨  -------------
      if (connInfo.type === 'zigbee') {
        connInfo.type = 'socket';
        connInfo.subType = 'parser';
        connInfo.port = 9000;
        connInfo.addConfigInfo = {
          parser: 'delimiterParser',
          option: '}}',
        };

        connInfo = {};
      } else if (connInfo.type === 'serial' && connInfo.subType === 'parser') {
        connInfo.type = 'socket';
        connInfo.port = 9005;
        connInfo.subType = '';
        delete connInfo.addConfigInfo;

        connInfo = {};
      } else if (connInfo.type === 'serial' && connInfo.subType === '') {
        connInfo.type = 'socket';
        connInfo.port = 9002;

        connInfo = {};
      }

      // FIXME: TEST 로 사용됨  -------------

      // 변환한 설정정보 입력
      _.set(dataLoggerInfo, 'connect_info', connInfo);
      _.set(dataLoggerInfo, 'protocol_info', protoInfo);

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

  /**
   * Control에서 Event가 발생했을 경우 처리 과정을 바인딩
   * 1. 정기 계측 명령이 완료되었을 경우 inverter 카테고리 데이터 정제 후 DB 저장
   */
  bindingEventHandler() {
    this.on('completeInquiryAllDeviceStatus', err => {
      // FIXME: 인버터 사용할 경우 해제
      // this.blockManager
      //   .refineDataContainer('inverter')
      //   .then(() => this.blockManager.saveDataToDB('inverter'))
      //   .catch(error => {
      //     BU.CLI(error.name);
      //   });
    });
  }
}
module.exports = MuanControl;
