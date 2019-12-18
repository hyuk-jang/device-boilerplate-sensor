const _ = require('lodash');
const { BU, CU } = require('base-util-jh');

const {
  dcmConfigModel: { commandStep: cmdStep, reqWrapCmdFormat: reqWCF },
} = require('../../../../../default-intelligence');

const Control = require('../../../Control');

const ApiClient = require('../../../features/ApiCommunicator/ApiClient');
const BlockManager = require('../../../features/BlockManager/BlockManager');

const blockConfig = require('./block.config');

const ConcreteAlgorithmStorage = require('./core/ConcreteAlgorithmStorage');

// 기본 모드
const Basic = require('./core/Basic');
// 발전 최적화 모드
const PowerOptimization = require('./core/PowerOptimization');
// 소금 생산 최적화 모드
const SalternOptimization = require('./core/SalternOptimization');

const commonFn = require('./core/algorithm/commonFn');

class MuanControl extends Control {
  /**
   * @override
   * DBS 순수 기능 외에 추가 될 기능
   */
  bindingFeature() {
    // 기본 Binding Feature 사용
    super.bindingFeature();
    // BU.CLI('bindingFeature');
    // super.bindingFeature();
    // const test = new DefaultApiClient(this);
    /** @type {DefaultApiClient} */
    this.apiClient = new ApiClient(this);

    /** @type {BlockManager} */
    this.blockManager = new BlockManager(this);

    // 100 kW 실증 부지에 관한 알고리즘 저장소 세팅
    const algorithmStorage = new ConcreteAlgorithmStorage(this);
    // 각 운용 모드별 알고리즘 모드 객체 추가
    algorithmStorage.addOperationMode(new Basic(this.coreFacade));
    algorithmStorage.addOperationMode(new PowerOptimization(this.coreFacade));
    algorithmStorage.addOperationMode(new SalternOptimization(this.coreFacade));
    algorithmStorage.algorithmModeList.forEach(child => child.init());
    // coreFacade에 알고리즘 저장소 등록
    this.coreFacade.setCoreAlgorithm(algorithmStorage);

    this.bindingEventHandler();
  }

  /**
   * @override
   * 생성된 Feature를 구동시킴
   * @param {dbsFeatureConfig} featureConfig
   */
  async runFeature(featureConfig = _.get(this, 'config.projectInfo.featureConfig', {})) {
    // BU.CLI(featureConfig);

    await this.blockManager.init(this.config.dbInfo, blockConfig);

    // 초기 구동 모드 Basic 변경
    this.coreFacade.changeOperationMode(commonFn.algorithmIdInfo.DEFAULT);

    // 정상적으로 구동이 된 후에 API Server에 접속함. 초기 API Client transmitStorageDataToServer 실행 때문.
    const { apiConfig } = featureConfig;
    this.apiClient.connect({
      controlInfo: {
        hasReconnect: true,
      },
      connect_info: apiConfig,
    });

    // 명령 종료가 떨어지면 장소 이벤트 갱신 처리
    this.on(cmdStep.END, commandStorage => {
      /** @type {CmdStorage} */
      const {
        wrapCmdInfo: { wrapCmdFormat, wrapCmdId, srcPlaceId, destPlaceId },
      } = commandStorage;

      switch (wrapCmdFormat) {
        case reqWCF.FLOW:
          // BU.CLI('지역 갱신을 시작하지', wrapCmdId);
          commonFn.emitReloadPlaceStorage(srcPlaceId);
          commonFn.emitReloadPlaceStorage(destPlaceId);
          break;
        default:
          break;
      }
    });
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

        // connInfo = {};
      } else if (connInfo.type === 'serial' && connInfo.subType === 'parser') {
        // 인버터
        connInfo.type = 'socket';
        connInfo.port = 9001;
        connInfo.subType = '';
        delete connInfo.addConfigInfo;

        connInfo = {};
      } else if (connInfo.type === 'modbus' && connInfo.subType === 'rtu') {
        // 접속반
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
    this.on('completeInquiryAllDeviceStatus', () => {
      // BU.CLI('completeInquiryAllDeviceStatus');
      const SALTERN = 'saltern';
      const INVERTER = 'inverter';
      const PV = 'connector';

      // 염전 Block Update
      this.saveBlockDB(SALTERN);

      // 인버터 Block Update
      this.saveBlockDB(INVERTER);

      // 접속반 Block Update
      this.saveBlockDB(PV);
    });
  }

  /**
   *
   * @param {string} category
   */
  async saveBlockDB(category) {
    // BU.CLI('saveBlockDB', category);
    try {
      await this.blockManager.refineDataContainer(category);
      await this.blockManager.saveDataToDB(category);
    } catch (error) {
      throw error;
    }
  }
}
module.exports = MuanControl;
