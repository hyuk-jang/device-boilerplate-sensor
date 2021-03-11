const _ = require('lodash');
const { BU, CU } = require('base-util-jh');

const Control = require('../../../Control');

const ApiClient = require('../../../features/ApiCommunicator/ApiClient');
const BlockManager = require('../../../features/BlockManager/BlockManager');

const blockConfig = require('./block.config');

module.exports = class extends Control {
  /**
   * @override
   * DBS 순수 기능 외에 추가 될 기능
   */
  bindingFeature() {
    // 기본 Binding Feature 사용
    super.bindingFeature();

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
    await this.blockManager.init(this.config.dbInfo, blockConfig);
    // 정상적으로 구동이 된 후에 API Server에 접속함. 초기 API Client transmitStorageDataToServer 실행 때문.
    const { apiConfig } = featureConfig;
    process.env.PJ_IS_API_CLIENT === '1' &&
      this.apiClient.connect({
        controlInfo: {
          hasReconnect: true,
        },
        connect_info: apiConfig,
      });
  }

  /**
   * @override
   * @desc init Step: 2
   * this.dataLoggerList 목록을 돌면서 DLC 객체를 생성하기 위한 설정 정보 생성
   */
  initMakeConfigForDLC() {
    BU.CLI('PJ_IS_INIT_DLC');
    const {
      env: { PJ_IS_INIT_DLC = '0' },
    } = process;
    if (PJ_IS_INIT_DLC === '0') {
      return super.initMakeConfigForDLC();
    }

    // 리스트 돌면서 데이터 로거에 속해있는 Node를 세팅함
    this.config.dataLoggerList = this.dataLoggerList.map(dataLoggerInfo => {
      const {
        data_logger_seq: seqDL,
        connect_info: connectInfo = {},
        protocol_info: protocolInfo = {},
        dl_target_code: dlCode,
      } = dataLoggerInfo;

      const foundNodeList = _.filter(
        this.nodeList,
        nodeInfo => nodeInfo.data_logger_seq === seqDL,
      );

      /** @type {connect_info} */
      let connInfo = JSON.parse(connectInfo);
      /** @type {protocol_info} */
      const protoInfo = JSON.parse(protocolInfo);

      // 장치 id가 Buffer 타입이라면 Buffer로 변환 후 strnig 으로 변환
      if (protoInfo.deviceId && protoInfo.deviceId.type === 'Buffer') {
        protoInfo.deviceId = Buffer.from(protoInfo.deviceId.data).toString();
      }

      // FIXME: TEST 로 사용됨  -------------
      if (protoInfo.mainCategory === 'UPSAS') {
        connInfo.type = 'socket';
        connInfo.subType = '';
        // connInfo.port = 9000;

        // protoInfo.wrapperCategory = 'default';

        // connInfo = {};

        // BU.CLIN(connInfo);
      }

      // FIXME: TEST 로 사용됨  -------------

      // 변환한 설정정보 입력
      _.set(dataLoggerInfo, 'connect_info', connInfo);
      _.set(dataLoggerInfo, 'protocol_info', protoInfo);
      // BU.CLI(connInfo);

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
    this.on('completeInquiryAllDeviceStatus', () => {
      // BU.CLI('completeInquiryAllDeviceStatus');
      // const SALTERN = 'saltern';
      const INVERTER = 'inverter';
      // const PV = 'connector';

      // // 염전 Block Update
      // this.saveBlockDB(SALTERN);

      // 인버터 Block Update
      this.saveBlockDB(INVERTER);

      // // 접속반 Block Update
      // this.saveBlockDB(PV);
    });
  }

  /**
   *
   * @param {string} category
   */
  async saveBlockDB(category) {
    // BU.CLI('saveBlockDB', category);
    await this.blockManager.refineDataContainer(category);
    await this.blockManager.saveDataToDB(category);
  }
};
