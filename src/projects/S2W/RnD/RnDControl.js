const _ = require('lodash');
const { BU, CU } = require('base-util-jh');
const { BM } = require('base-model-jh');

const Control = require('../../../Control');

const ApiClient = require('../../../features/ApiCommunicator/ApiClient');
const BlockManager = require('../../../features/BlockManager/BlockManager');

const blockConfig = require('./block.config');

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
    // BU.CLI(featureConfig);
    // FIXME: DBW에 접속 처리하지 않음. Map 위치 정보 및 DBW API Server 구동 시 해제 (2019-02-13)
    // const { apiConfig } = featureConfig;
    // this.apiClient.connect({
    //   controlInfo: {
    //     hasReconnect: true,
    //   },
    //   connect_info: apiConfig,
    // });

    await this.blockManager.init(this.config.dbInfo, blockConfig);
  }

  /**
   * @override
   * @desc init Step: 2
   * this.dataLoggerList 목록을 돌면서 DLC 객체를 생성하기 위한 설정 정보 생성
   */
  initMakeConfigForDLC() {
    // BU.CLI('initMakeConfigForDLC');
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
      // 농병 센서
      if (protoInfo.mainCategory === 'S2W') {
        connInfo.type = 'socket';
        connInfo.subType = '';
        connInfo.port = 9000;
        // connInfo.hasPassive = false;

        switch (protoInfo.deviceId) {
          case '\u0001':
          case '\u0002':
          case '\u0003':
          case '\u0004':
          case '\u0005':
          case '\u0006':
          case '\u0007':
            connInfo.port = 9000;
            break;
          case '\u0008':
          case '\u0009':
            connInfo.port = 9001;
            break;
          case '\u000a':
          case '\u000b':
            connInfo.port = 9002;
            break;
          case '\u000c':
          case '\u000d':
            connInfo.port = 9003;
            break;
          case '\u000e':
          case '\u000f':
          case '\u0010':
            connInfo.port = 9004;
            break;

          default:
            break;
        }

        protoInfo.wrapperCategory = 'default';

        // connInfo = {};
      } else if (protoInfo.subCategory === 'ESP3K5') {
        connInfo.type = 'socket';
        connInfo.port = 9005;
        // connInfo.subType = '';
        // connInfo.hasPassive = false;

        protoInfo.wrapperCategory = 'default';
        delete connInfo.addConfigInfo;

        // FIXME: Site에 따라 인버터 접속 유무 조절(현지 상황에 따라 수정 필요)
        // 현재 모든 농병 사이트 인버터 계측하지 않음
        switch (this.mainUUID) {
          // case '101':
          case '102':
          case '103':
          case '104':
            connInfo = {};
            break;
          default:
            break;
        }

        // connInfo = {};
      }
      // FIXME: TEST 로 사용됨  -------------

      // 변환한 설정정보 입력
      !_.isEmpty(connInfo) && _.set(dataLoggerInfo, 'connect_info', connInfo);
      !_.isEmpty(protoInfo) && _.set(dataLoggerInfo, 'protocol_info', protoInfo);

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
    this.on('completeInquiryAllDeviceStatus', () => {
      this.blockManager
        .refineDataContainer('inverter')
        .then(() => this.blockManager.saveDataToDB('inverter'));
      this.blockManager
        .refineDataContainer('farmSensor')
        .then(() => this.blockManager.saveDataToDB('farmSensor'));
    });
  }
}
module.exports = MuanControl;