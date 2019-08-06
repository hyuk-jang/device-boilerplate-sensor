const _ = require('lodash');
const { BU, CU } = require('base-util-jh');
const { BM } = require('base-model-jh');

const Control = require('../../../Control');

const ApiClient = require('../../../features/ApiCommunicator/ApiClient');
const PBS = require('../../../features/PowerStatusBoard/PBS');
const BlockManager = require('../../../features/BlockManager/BlockManager');

const blockConfig = require('./block.config');

// const SmartSalternStorage = require('../smartSalternCore/SmartSalternStorage');
const Algorithm = require('./core/Algorithm');

const CoreFacade = require('../../../core/CoreFacade');

const commonFn = require('./core/commonFn/commonFn');

const {
  dcmConfigModel: {
    reqWrapCmdFormat: reqWCF,
    reqWrapCmdType: reqWCT,
    placeNodeStatus: pNS,
    goalDataRange: goalDR,
    commandStep: cmdStep,
  },
} = CoreFacade;

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

    /** @type {PBS} */
    this.powerStatusBoard = new PBS(this);

    /** @type {BlockManager} */
    this.blockManager = new BlockManager(this);

    // const criticalSetter = new CriticalSetter(this);

    // criticalSetter.init();

    // BU.CLIN(this.placeList);

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

    // BU.CLIN(M100kPlaceAlgorithm);

    const coreFacade = new CoreFacade();
    // coreFacade.setCoreAlgorithm(new M100kPlaceAlgorithm());
    coreFacade.setCoreAlgorithm(new Algorithm());

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
