const _ = require('lodash');
const {BU} = require('base-util-jh');
const bmjh = require('../../../base-model-jh');
const EchoServer = require('../../../device-echo-server-jh');
// const AbstDeviceClient = require('device-client-controller-jh');
const AbstDeviceClient = require('../../../device-client-controller-jh');

const Model = require('./Model');
// const { AbstConverter, BaseModel } = require('device-protocol-converter-jh');
const {MainConverter, BaseModel} = require('../../../device-protocol-converter-jh');

const {
  requestOrderCommandType,
  requestDeviceControlType,
} = require('../../../default-intelligence').dcmConfigModel;
// require('../../../default-intelligence');
// const {AbstConverter} = require('device-protocol-converter-jh');

const DataLoggerController = class extends AbstDeviceClient {
  /** @param {dataLoggerConfig} config */
  constructor(config) {
    super();

    this.config = config;
    this.BaseModel = BaseModel;

    // Model deviceData Prop 정의
    this.observerList = [];

    /** @type {dataLoggerInfo} */
    this.dataLoggerInfo = {};

    /** @type {nodeInfo[]} */
    this.nodeList = [];
  }

  /**
   * 컨트롤러 ID를 가져올 경우
   * @return {string} Device Controller를 대표하는 ID
   */
  get id() {
    return this.config.deviceInfo.target_id;
  }

  /**
   * DB에 저장할 경우 분류 단위
   * @return {string}
   */
  get category() {
    return this.config.deviceInfo.target_category;
  }

  /**
   * 조건에 맞는 노드 리스트를 구함
   * @param {nodeInfo} nodeInfo
   */
  findNodeList(nodeInfo) {
    return _.filter(this.nodeList, node =>
      _.every(nodeInfo, (value, key) => _.isEqual(node[key], value)),
    );
  }

  /**
   * @desc Step 0: DB에서 직접 세팅하고자 할 경우
   * DB에서 특정 데이터를 가져오고 싶을경우
   * @param {dbInfo} dbInfo
   * @param {{data_logger_seq: number, main_seq: number}} where Logger Sequence
   */
  async s0SetDataLoggerDeviceByDB(dbInfo, where) {
    try {
      const BM = new bmjh.BM(dbInfo);
      let dataLoggerInfo = await BM.getTable('v_dv_data_logger', where, false);

      if (dataLoggerInfo.length > 1) {
        throw new Error('조건에 맞는 데이터 로거가 1개를 초과하였습니다.');
      } else if (dataLoggerInfo.length === 0) {
        throw new Error('조건에 맞는 데이터 로거가 검색되지 않았습니다.');
      }

      this.nodeList = await BM.getTable('v_node_profile', where, false);
      dataLoggerInfo = _.head(dataLoggerInfo);
      dataLoggerInfo.protocol_info = JSON.parse(_.get(dataLoggerInfo, 'protocol_info'));
      dataLoggerInfo.connect_info = JSON.parse(_.get(dataLoggerInfo, 'connect_info'));

      this.dataLoggerInfo = dataLoggerInfo;

      // BU.writeFile('out.json', file);
    } catch (error) {
      BU.logFile(error);
    }
  }

  /**
   * @desc Step 1: Data Logger 정보 설정
   * 데이터 로거 정보 입력
   * @param {dataLoggerInfo} dataLoggerInfo
   */
  s1SetDataLogger(dataLoggerInfo) {
    this.dataLoggerInfo = dataLoggerInfo;
  }

  /**
   * @desc Step 1: Node Info 정보 설정
   * 노드 장치를 추가할 경우. node_id 가 동일하다면 추가하지 않음
   * @param {nodeInfo[]} nodeInfoList
   */
  s1AddNodeList(nodeInfoList) {
    nodeInfoList.forEach(nodeInfo => {
      const foundIt = _.find(this.nodeList, {
        node_id: nodeInfo.node_id,
      });
      if (_.isEmpty(foundIt)) {
        // Node에 Data Logger 바인딩
        nodeInfo.getDataLogger = () => this.dataLoggerInfo;
        this.nodeList.push(nodeInfo);
      }
    });
  }

  /**
   * config에 저장된 값으로 설정하고자 할 경우
   */
  s1SetLoggerAndNodeByConfig() {
    this.s1AddNodeList(this.config.nodeList);
    this.s1SetDataLogger(this.config.dataLoggerInfo);
  }

  /**
   * @desc Step 2, Data Logger Info 를 DeviceInfo로 변환하여 저장
   * dataLoggerInfo 를 deviceInfo로 변환하여 저장
   */
  s2SetDeviceInfo() {
    this.config.deviceInfo = {
      target_id: this.dataLoggerInfo.dl_id,
      // target_category: 'Saltern',
      target_name: this.dataLoggerInfo.dld_target_name,
      connect_info: this.dataLoggerInfo.connect_info,
      protocol_info: this.dataLoggerInfo.protocol_info,
      controlInfo: {
        hasErrorHandling: true,
        hasOneAndOne: false,
        hasReconnect: true,
      },
      logOption: {
        hasCommanderResponse: true,
        hasDcError: true,
        hasDcEvent: true,
        hasDcMessage: true,
        hasReceiveData: true,
        hasTransferCommand: true,
      },
    };
  }

  /**
   * @desc Step 3
   * device client 설정 및 프로토콜 바인딩
   */
  init() {
    const protocolInfo = _.get(this.config, 'deviceInfo.protocol_info');
    this.converter = new MainConverter(protocolInfo);
    this.baseModel = new BaseModel.UPSAS(protocolInfo);
    this.deviceModel = this.baseModel.device;

    // 모델 선언
    this.model = new Model(this);

    /** 개발 버젼일 경우 Echo Server 구동 */
    if (this.config.hasDev) {
      // const EchoServer = require('device-echo-server-jh');
      // 지정된 port로 생성
      const echoServer = new EchoServer(this.config.deviceInfo.connect_info.port);
      // 해당 protocol 파서에 나와있는 객체 생성
      echoServer.attachDevice(this.config.deviceInfo.protocol_info);
    }
    // BU.CLI(this.config.deviceInfo);
    this.setDeviceClient(this.config.deviceInfo);
    this.converter.setProtocolConverter();
  }

  /**
   * Observer Pattern을 사용할 경우 추가
   * @desc Parent Boileplate를 사용할 경우 자동 추가
   * @param {Object} parent
   */
  attach(parent) {
    this.observerList.push(parent);
  }

  /**
   * 장치의 현재 데이터 및 에러 내역을 가져옴
   */
  getDeviceOperationInfo() {
    return {
      id: this.config.deviceInfo.target_id,
      config: this.config.deviceInfo,
      nodeList: this.nodeList,
      // systemErrorList: [{code: 'new Code2222', msg: '에러 테스트 메시지22', occur_date: new Date() }],
      systemErrorList: this.systemErrorList,
      troubleList: [],
      measureDate: new Date(),
    };
  }

  /**
   * 외부에서 명령을 내릴경우
   * @param {executeOrderInfo} executeOrderInfo
   */
  orderOperation(executeOrderInfo) {
    // BU.CLIN(executeOrderInfo);
    try {
      // nodeId가 dl_id와 동일하거나 없을 경우 데이터 로거에 요청한거라고 판단
      const nodeId = _.get(executeOrderInfo, 'nodeId', '');
      if (nodeId === this.dataLoggerInfo.dl_id || nodeId === '' || nodeId === undefined) {
        return this.orderOperationToDataLogger(executeOrderInfo);
      }
      const nodeInfo = _.find(this.nodeList, {
        node_id: executeOrderInfo.nodeId,
      });
      // let modelId = orderInfo.modelId;
      if (_.isEmpty(nodeInfo)) {
        throw new Error(`Node ${executeOrderInfo.nodeId} 장치는 존재하지 않습니다.`);
      }

      const cmdList = this.converter.generationCommand({
        key: nodeInfo.nc_target_id,
        value: _.get(executeOrderInfo, 'controlValue'),
      });

      // BU.CLI(cmdList);
      const cmdName = `${nodeInfo.node_name} ${nodeInfo.node_id} Type: ${
        executeOrderInfo.controlValue
      }`;

      // 장치를 열거나
      const rank = _.isNumber(_.get(executeOrderInfo, 'rank'))
        ? _.get(executeOrderInfo, 'rank')
        : this.definedCommandSetRank.THIRD;
      const commandSet = this.generationManualCommand({
        integratedUUID: executeOrderInfo.integratedUUID,
        cmdList,
        commandId: executeOrderInfo.requestCommandId,
        commandName: cmdName,
        commandType: executeOrderInfo.requestCommandType,
        uuid: executeOrderInfo.uuid,
        nodeId: executeOrderInfo.nodeId,
        rank,
      });

      // BU.CLIN(commandSet);
      // 장치로 명령 요청
      this.executeCommand(commandSet);
      // 명령 요청에 문제가 없으므로 현재 진행중인 명령에 추가
      return this.model.addRequestCommandSet(commandSet);
    } catch (error) {
      BU.CLI(error);
      throw error;
    }
  }

  /**
   * DataLogger Default 명령을 내리기 위함
   * @param {executeOrderInfo} executeOrder
   */
  orderOperationToDataLogger(
    /** @type {executeOrderInfo} */
    executeOrder = {
      requestCommandId: `${this.dataLoggerInfo.dl_id} ${requestDeviceControlType.MEASURE}`,
      requestCommandType: requestOrderCommandType.MEASURE,
      rank: this.definedCommandSetRank.THIRD,
    },
  ) {
    try {
      const cmdList = this.converter.generationCommand({
        key: 'DEFAULT',
        value: requestDeviceControlType.MEASURE,
      });
      const cmdName = `${this.config.dataLoggerInfo.dld_target_name} ${
        this.config.dataLoggerInfo.dl_target_code
      } Type: ${executeOrder.requestCommandType}`;
      // 장치를 열거나
      const rank = this.definedCommandSetRank.THIRD;

      const commandSet = this.generationManualCommand({
        integratedUUID: executeOrder.integratedUUID,
        cmdList,
        commandId: executeOrder.requestCommandId,
        commandName: cmdName,
        uuid: executeOrder.uuid,
        commandType: executeOrder.requestCommandType,
        rank,
      });

      this.executeCommand(commandSet);
      // BU.CLIN(this.manager.findCommandStorage({commandId: requestOrderInfo.requestCommandId}), 4);

      // 명령 요청에 문제가 없으므로 현재 진행중인 명령에 추가
      return this.model.addRequestCommandSet(commandSet);
    } catch (error) {
      BU.CLI(error);
    }
  }

  /**
   * @override
   * Device Controller 변화가 생겨 관련된 전체 Commander에게 뿌리는 Event
   * @param {dcEvent} dcEvent
   * @example 보통 장치 연결, 해제에서 발생
   * dcConnect --> 장치 연결,
   * dcDisconnect --> 장치 연결 해제
   */
  updatedDcEventOnDevice(dcEvent) {
    // super.updatedDcEventOnDevice(dcEvent);

    // Observer가 해당 메소드를 가지고 있다면 전송
    _.forEach(this.observerList, observer => {
      if (_.get(observer, 'notifyDeviceEvent')) {
        observer.notifyDeviceEvent(this, dcEvent);
      }
    });
  }

  /**
   * @override
   * 장치에서 명령을 수행하는 과정에서 생기는 1:1 이벤트
   * @param {dcError} dcError 현재 장비에서 실행되고 있는 명령 객체
   */
  onDcError(dcError) {
    super.onDcError(dcError);

    // Error가 발생하면 추적 중인 데이터는 폐기 (config.deviceInfo.protocol_info.protocolOptionInfo.hasTrackingData = true 일 경우 추적하기 때문에 Data를 계속 적재하는 것을 방지함)
    this.converter.resetTrackingDataBuffer();
    this.requestTakeAction(this.definedCommanderResponse.NEXT)
    // Observer가 해당 메소드를 가지고 있다면 전송
    _.forEach(this.observerList, observer => {
      if (_.get(observer, 'notifyDeviceError')) {
        observer.notifyDeviceError(this, dcError);
      }
    });
  }

  /**
   * @override
   * 메시지 발생 핸들러
   * @param {dcMessage} dcMessage
   */
  onDcMessage(dcMessage) {
    // super.onDcMessage(dcMessage);
    switch (dcMessage.msgCode) {
      // 명령 수행이 완료되었다고 판단이 되면 현재 진행중인 명령 완료로 처리
      case this.definedCommandSetMessage.COMMANDSET_EXECUTION_TERMINATE:
      case this.definedCommandSetMessage.COMMANDSET_DELETE:
        // BU.CLIN(this.model.requestCommandSetList);
        this.model.completeRequestCommandSet(dcMessage.commandSet);
        break;
      default:
        break;
    }

    // Observer가 해당 메소드를 가지고 있다면 전송
    this.observerList.forEach(observer => {
      if (_.get(observer, 'notifyDeviceMessage')) {
        observer.notifyDeviceMessage(this, dcMessage);
      }
    });
  }

  /**
   * 장치로부터 데이터 수신
   * @override
   * @param {dcData} dcData 현재 장비에서 실행되고 있는 명령 객체
   */
  onDcData(dcData) {
    // super.onDcData(dcData);
    try {
      const parsedData = this.converter.parsingUpdateData(dcData);

      // BU.CLI(parsedData);
      // 만약 파싱 에러가 발생한다면 명령 재 요청
      if (parsedData.eventCode === this.definedCommanderResponse.ERROR) {
        return this.requestTakeAction(this.definedCommanderResponse.RETRY);
      }
      // BU.CLI(this.id, parsedData.data)
      // 데이터가 정상적이라면
      if (parsedData.eventCode === this.definedCommanderResponse.DONE) {
        const renewalNodeList = this.model.onData(parsedData.data);
        // 데이터가 갱신되었다면 Observer에게 알림.
        if (renewalNodeList.length) {
          this.observerList.forEach(observer => {
            if (_.get(observer, 'notifyDeviceData')) {
              observer.notifyDeviceData(this, renewalNodeList);
            }
          });
        }
      }
      // Device Client로 해당 이벤트 Code를 보냄
      return this.requestTakeAction(parsedData.eventCode);
    } catch (error) {
      BU.logFile(error);
      throw error;
    }
  }
};
module.exports = DataLoggerController;
