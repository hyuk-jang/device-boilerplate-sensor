const _ = require('lodash');
const eventToPromise = require('event-to-promise');

const { BU } = require('base-util-jh');
const { BM } = require('base-model-jh');
// const AbstDeviceClient = require('device-client-controller-jh');
const AbstDeviceClient = require('../../../device-client-controller-jh');

const Model = require('./Model');
// const { AbstConverter, BaseModel } = require('device-protocol-converter-jh');
const { MainConverter, BaseModel } = require('../../../device-protocol-converter-jh');

const {
  requestOrderCommandType,
  requestDeviceControlType,
} = require('../../../default-intelligence').dcmConfigModel;
// require('../../../default-intelligence');
// const {AbstConverter} = require('device-protocol-converter-jh');

class DataLoggerController extends AbstDeviceClient {
  /** @param {dataLoggerConfig} config */
  constructor(config) {
    super();

    this.config = config;
    // BU.CLI(this.config);

    /** @type {deviceInfo} Controller 객체의 생성 정보를 담고 있는 설정 정보 */
    this.deviceInfo;
    /** @type {connect_info} DCC를 생성하기 위한 설정 정보 */
    this.connectInfo;
    /** @type {protocol_info} DPC를 생성하기 위한 설정 정보  */
    this.protocolInfo;

    this.BaseModel = BaseModel;

    // Model deviceData Prop 정의
    this.observerList = [];

    /** @type {dataLoggerInfo} */
    this.dataLoggerInfo = {};

    /** @type {nodeInfo[]} */
    this.nodeList = [];

    /** @type {string} 사이트 지점 ID */
    this.siteUUID = null;
  }

  /**
   * 컨트롤러 ID를 가져올 경우
   * @return {string} Device Controller를 대표하는 ID
   */
  get id() {
    return this.deviceInfo.target_id;
  }

  /**
   * DB에 저장할 경우 분류 단위
   * @return {string}
   */
  get category() {
    return this.deviceInfo.target_category;
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
      const biModule = new BM(dbInfo);
      let dataLoggerInfo = await biModule.getTable('v_dv_data_logger', where, false);

      if (dataLoggerInfo.length > 1) {
        throw new Error('조건에 맞는 데이터 로거가 1개를 초과하였습니다.');
      } else if (dataLoggerInfo.length === 0) {
        throw new Error('조건에 맞는 데이터 로거가 검색되지 않았습니다.');
      }

      this.nodeList = await biModule.getTable('v_node_profile', where, false);
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
    // BU.CLI(this.siteUUID, nodeInfoList.length);
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
    this.deviceInfo = {
      target_id: this.dataLoggerInfo.dl_real_id,
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

    this.connectInfo = this.deviceInfo.connect_info;
    this.protocolInfo = this.deviceInfo.protocol_info;
  }

  /**
   * @desc Step 3
   * device client 설정 및 프로토콜 바인딩
   * @param {string=} siteUUID 장치가 연결된 지점을 특정지을 or 개소, setPassiveClient에 사용
   * @return {Promise.<DataLoggerController>} 생성된 현 객체 반환
   */
  async init(siteUUID) {
    this.converter = new MainConverter(this.protocolInfo);
    // 모델 선언
    this.model = new Model(this);
    try {
      const { CONNECT, DISCONNECT } = this.definedControlEvent;
      // 프로토콜 컨버터 바인딩
      this.converter.setProtocolConverter();

      // DCC 초기화 시작
      // connectInfo가 없거나 수동 Client를 사용할 경우
      if (_.isEmpty(this.connectInfo) || this.connectInfo.hasPassive) {
        // BU.CLI('setPassiveClient', this.id);
        // 수동 클라이언트를 사용할 경우에는 반드시 사이트 UUID가 필요함
        if (_.isString(siteUUID)) {
          // BU.CLI('setPassiveClient', this.id, siteUUID);
          // 해당 사이트 고유 ID
          this.siteUUID = siteUUID;
          this.setPassiveClient(this.deviceInfo, siteUUID);
          return this;
        }
        throw new ReferenceError('Initialization failed.');
      }
      // 접속 경로가 존재시 선언 및 자동 접속을 수행

      this.setDeviceClient(this.deviceInfo);

      // 만약 장치가 접속된 상태라면
      if (this.hasConnectedDevice) {
        return this;
      }

      // BU.CLI('DataLogger Init', this.config.dataLoggerInfo.dl_real_id)
      // 장치와의 접속 수립이 아직 안되었을 경우 장치 접속 결과를 기다림
      await eventToPromise.multi(this, [CONNECT], [DISCONNECT]);
      // BU.CLI('Connected', this.id);
      // Controller 반환
      return this;
    } catch (error) {
      // 초기화에 실패할 경우에는 에러 처리
      if (error instanceof ReferenceError) {
        throw error;
      }
      // Controller 반환
      return this;
    }
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
      id: this.id,
      config: this.deviceInfo,
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
    if (process.env.LOG_DLC_ORDER === '1') {
      BU.CLIN(executeOrderInfo);
    }
    try {
      const {
        integratedUUID,
        requestCommandId,
        requestCommandType,
        uuid,
        controlValue,
        nodeId = '',
        rank = this.definedCommandSetRank.THIRD,
      } = executeOrderInfo;
      // BU.CLI(this.siteUUID);
      if (!this.hasConnectedDevice) {
        throw new Error(`The device has been disconnected. ${_.get(this.connectInfo, 'port')}`);
      }

      // nodeId가 dl_id와 동일하거나 없을 경우 데이터 로거에 요청한거라고 판단
      if (nodeId === this.dataLoggerInfo.dl_id || nodeId === '' || nodeId === undefined) {
        return this.orderOperationToDataLogger(executeOrderInfo);
      }
      const nodeInfo = _.find(this.nodeList, {
        node_id: nodeId,
      });
      // let modelId = orderInfo.modelId;
      if (_.isEmpty(nodeInfo)) {
        throw new Error(`Node ${executeOrderInfo.nodeId} 장치는 존재하지 않습니다.`);
      }

      const cmdList = this.converter.generationCommand({
        key: nodeInfo.nd_target_id,
        value: controlValue,
      });

      const commandName = `${nodeInfo.node_name} ${nodeInfo.node_id} Type: ${controlValue}`;

      const commandSet = this.generationManualCommand({
        integratedUUID,
        cmdList,
        commandId: requestCommandId,
        commandName,
        commandType: requestCommandType,
        uuid,
        nodeId,
        rank,
      });

      // BU.CLIN(commandSet);
      // 장치로 명령 요청
      this.executeCommand(commandSet);
      // 명령 요청에 문제가 없으므로 현재 진행중인 명령에 추가
      return this.model.addRequestCommandSet(commandSet);
    } catch (error) {
      // BU.CLI(error);
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
      if (!this.hasConnectedDevice) {
        throw new Error(`The device has been disconnected. ${_.get(this.connectInfo, 'port')}`);
      }
      const cmdList = this.converter.generationCommand({
        key: 'DEFAULT',
        value: requestDeviceControlType.MEASURE,
      });
      const cmdName = `${this.config.dataLoggerInfo.dld_target_name} ${
        this.config.dataLoggerInfo.dl_target_code
      } Type: ${executeOrder.requestCommandType}`;

      const commandSet = this.generationManualCommand({
        integratedUUID: executeOrder.integratedUUID,
        cmdList,
        commandId: executeOrder.requestCommandId,
        commandName: cmdName,
        uuid: executeOrder.uuid,
        commandType: executeOrder.requestCommandType,
        rank: this.definedCommandSetRank.THIRD,
      });

      this.executeCommand(commandSet);

      // BU.CLI(commandSet.cmdList)
      // BU.CLIN(this.manager.findCommandStorage({commandId: requestOrderInfo.requestCommandId}), 4);

      // 명령 요청에 문제가 없으므로 현재 진행중인 명령에 추가
      return this.model.addRequestCommandSet(commandSet);
    } catch (error) {
      BU.CLI(error);
      throw error;
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
    if (process.env.LOG_DLC_EVENT === '1') {
      super.updatedDcEventOnDevice(dcEvent);
    }

    const { CONNECT, DISCONNECT } = this.definedControlEvent;

    switch (dcEvent.eventName) {
      case CONNECT:
        this.emit(CONNECT);
        break;
      case DISCONNECT:
        this.emit(DISCONNECT);
        break;
      default:
        break;
    }

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
    if (process.env.LOG_DLC_ERROR === '1') {
      super.onDcError(dcError);
    }

    const { NEXT } = this.definedCommanderResponse;

    // Error가 발생하면 추적 중인 데이터는 폐기 (config.deviceInfo.protocol_info.protocolOptionInfo.hasTrackingData = true 일 경우 추적하기 때문에 Data를 계속 적재하는 것을 방지함)
    this.converter.resetTrackingDataBuffer();
    this.requestTakeAction(NEXT);
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
    // 명령 완료, 명령 삭제
    const { COMMANDSET_EXECUTION_TERMINATE, COMMANDSET_DELETE } = this.definedCommandSetMessage;

    switch (dcMessage.msgCode) {
      // 명령 수행이 완료되었다고 판단이 되면 현재 진행중인 명령 완료로 처리
      case COMMANDSET_EXECUTION_TERMINATE:
      case COMMANDSET_DELETE:
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
    if (process.env.LOG_DLC_ON_DATA === '1') {
      super.onDcData(dcData);
    }
    try {
      const { DONE, ERROR, WAIT } = this.definedCommanderResponse;
      const { eventCode, data } = this.converter.parsingUpdateData(dcData);

      if (process.env.LOG_DLC_ON_DATA === '1') {
        BU.CLI(data);
      }
      // Retry 시도 시 다중 명령 요청 및 수신이 이루어 지므로 Retry 하지 않음.
      if (eventCode === ERROR) {
        return this.requestTakeAction(WAIT);
      }
      // 데이터가 정상적이라면
      if (eventCode === DONE) {
        // Device Client로 해당 이벤트 Code를 보냄
        this.requestTakeAction(eventCode)
        const renewalNodeList = this.model.onData(data);
        // 데이터가 갱신되었다면 Observer에게 알림.
        if (renewalNodeList.length) {
          if (process.env.LOG_DLC_RENEWAL_DATA === '1') {
            const pickedNodeList = _(renewalNodeList)
              .map(node => _.pick(node, ['node_id', 'data']))
              .value();
            BU.CLI(this.id, pickedNodeList);
          }
          this.observerList.forEach(observer => {
            if (_.get(observer, 'notifyDeviceData')) {
              observer.notifyDeviceData(this, renewalNodeList);
            }
          });
        }
      }
      // Device Client로 해당 이벤트 Code를 보냄
      // return this.requestTakeAction(eventCode);
    } catch (error) {
      BU.logFile(error);
      throw error;
    }
  }
}
module.exports = DataLoggerController;
