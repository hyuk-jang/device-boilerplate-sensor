const _ = require('lodash');
const { BU, CU } = require('base-util-jh');

const Control = require('../../../Control');

const ApiClient = require('../../../features/ApiCommunicator/ApiClient');
const BlockManager = require('../../../features/BlockManager/BlockManager');

const ConcreteAlgorithmStorage = require('./core/ConcreteAlgorithmStorage');

// 기본 모드
const Basic = require('./core/Basic');
// 자동 모드
const Automation = require('./core/Automation');
const commonFn = require('./core/algorithm/commonFn');

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

    // 100 kW 실증 부지에 관한 알고리즘 저장소 세팅
    const algorithmStorage = new ConcreteAlgorithmStorage(this.coreFacade);
    // 각 운용 모드별 알고리즘 모드 객체 추가
    algorithmStorage.addOperationMode(new Basic(this.coreFacade));
    algorithmStorage.addOperationMode(new Automation(this.coreFacade));
    algorithmStorage.algorithmModeList.forEach(child => child.init());
    // coreFacade에 알고리즘 저장소 등록
    this.coreFacade.setCoreAlgorithm(algorithmStorage);
  }

  /**
   * @override
   * 생성된 Feature를 구동시킴
   * @param {dbsFeatureConfig} featureConfig
   */
  async runFeature(featureConfig = _.get(this, 'config.projectInfo.featureConfig', {})) {
    // 초기 구동 모드 Basic 변경
    this.coreFacade.changeOperationMode(commonFn.algorithmIdInfo.DEFAULT);

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
      if (dlCode === '001') {
        connInfo.type = 'socket';
        // connInfo.subType = '';
        connInfo.host = PJ_IS_INIT_DLC === '2' ? '192.168.0.158' : 'localhost';
        connInfo.port = PJ_IS_INIT_DLC === '2' ? 15800 : 15300;
        // connInfo.port = PJ_IS_INIT_DLC === '2' ? 15810 : 15300;
        connInfo.hasOnDataClose = true;
        // BU.CLI(connInfo);
        // connInfo.port = 15300;
        // connInfo = {};
      } else if (dlCode === '002') {
        connInfo.type = 'socket';
        // connInfo.subType = '';
        connInfo.host = PJ_IS_INIT_DLC === '2' ? '192.168.0.158' : 'localhost';
        connInfo.port = PJ_IS_INIT_DLC === '2' ? 15801 : 15301;
        // connInfo.port = PJ_IS_INIT_DLC === '2' ? 15811 : 15301;
        connInfo.hasOnDataClose = true;
        // connInfo.port = 15301;
        // connInfo = {};
      } else if (dlCode === '003') {
        connInfo.host = 'localhost';
        connInfo.port = 15303;
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
};
