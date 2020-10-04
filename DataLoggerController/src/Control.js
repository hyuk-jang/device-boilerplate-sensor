const _ = require('lodash');
const eventToPromise = require('event-to-promise');

const { BU } = require('base-util-jh');
const { BM } = require('base-model-jh');

const Model = require('./Model');

const { DccFacade, di, dpc } = require('../../src/module');

const { MainConverter } = dpc;

const {
  dcmConfigModel: { reqWrapCmdFormat, reqDeviceControlType },
} = di;

class DataLoggerController extends DccFacade {
  /** @param {dataLoggerConfig} config */
  constructor(config) {
    super();

    this.config = config;

    this.isConnected = false;

    /** @type {deviceInfo} Controller 객체의 생성 정보를 담고 있는 설정 정보 */
    this.deviceInfo;
    /** @type {connect_info} DCC를 생성하기 위한 설정 정보 */
    this.connectInfo;
    /** @type {protocol_info} DPC를 생성하기 위한 설정 정보  */
    this.protocolInfo;

    // Model deviceData Prop 정의
    this.observerList = [];

    /** @type {dataLoggerInfo} */
    this.dataLoggerInfo = {};

    /** @type {nodeInfo[]} */
    this.nodeList = [];

    /** @type {string} 사이트 지점 ID */
    this.siteUUID = null;

    /** @type {number} DLC 에러 누적 횟수 */
    this.errorCount = 0;
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
   * DLC에 대한 오류가 3번을 넘을 경우 DLC에 문제가 있는 것으로 판단
   */
  get isErrorDLC() {
    return this.errorCount > 3;
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
    // BU.CLI('init');
    // 프로토콜 변환 객체 생성
    try {
      const { CONNECT, DISCONNECT } = this.definedControlEvent;
      // 프로토콜 컨버터 바인딩
      this.converter = new MainConverter(this.protocolInfo);

      this.converter.setProtocolConverter();
      // 모델 선언
      this.model = new Model(this);
      // 중앙 값 사용하는 Node가 있다면 적용
      const filterdNodeList = _.filter(this.nodeList, { is_avg_center: 1 });
      if (filterdNodeList.length) {
        this.model.bindingAverageStorageForNode(filterdNodeList, true);
      }
      // DCC 초기화 시작
      // connectInfo가 없거나 수동 Client를 사용할 경우
      if (_.isEmpty(this.connectInfo) || this.connectInfo.hasPassive) {
        // 수동 클라이언트를 사용할 경우에는 반드시 사이트 UUID가 필요함
        if (_.isString(siteUUID)) {
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

      // 장치와의 접속 수립이 아직 안되었을 경우 장치 접속 결과를 기다림
      await eventToPromise.multi(this, [CONNECT], [DISCONNECT]);
      // Controller 반환
      return this;
    } catch (error) {
      BU.errorLog('init', error);
      BU.CLIN(error);
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
   * @param {executeCmdInfo} executeCmdInfo
   */
  requestCommand(executeCmdInfo) {
    try {
      if (process.env.LOG_DLC_ORDER === '1') {
        BU.CLIN(executeCmdInfo);
      }

      const {
        wrapCmdUUID,
        wrapCmdId,
        wrapCmdType,
        uuid,
        singleControlType,
        controlSetValue,
        nodeId = '',
        rank = this.definedCommandSetRank.THIRD,
      } = executeCmdInfo;

      if (!this.hasConnectedDevice) {
        throw new Error(
          `The device has been disconnected. ${_.get(this.connectInfo, 'port')}`,
        );
      }

      // nodeId가 dl_id와 동일하거나 없을 경우 데이터 로거에 요청한거라고 판단
      if (nodeId === this.dataLoggerInfo.dl_id || nodeId === '' || nodeId === undefined) {
        return this.requestDefaultCommand(executeCmdInfo);
      }

      const nodeInfo = _.find(this.nodeList, {
        node_id: nodeId,
      });

      if (_.isEmpty(nodeInfo)) {
        throw new Error(`Node ${executeCmdInfo.nodeId} 장치는 존재하지 않습니다.`);
      }

      const cmdList = this.converter.generationCommand({
        key: nodeInfo.nd_target_id,
        value: singleControlType,
        setValue: controlSetValue,
        nodeInfo,
      });

      const commandName = `${nodeInfo.node_name} ${
        nodeInfo.node_id
      } Type: ${singleControlType}`;

      const commandSet = this.generationManualCommand({
        wrapCmdUUID,
        cmdList,
        commandId: wrapCmdId,
        commandName,
        commandType: wrapCmdType,
        uuid,
        nodeId,
        rank,
      });

      // 장치로 명령 요청
      this.executeCommand(commandSet);

      // 명령 요청에 문제가 없으므로 현재 진행중인 명령에 추가
      return this.model.addRequestCommandSet(commandSet);
    } catch (error) {
      // BU.error(error);
      throw error;
    }
  }

  /**
   * DataLogger Default 명령을 내리기 위함
   * @param {executeCmdInfo} executeCmd
   */
  requestDefaultCommand(executeCmd) {
    const {
      wrapCmdUUID,
      uuid,
      wrapCmdId = `${this.dataLoggerInfo.dl_id} ${reqDeviceControlType.MEASURE}`,
      wrapCmdType = reqWrapCmdFormat.MEASURE,
      rank = this.definedCommandSetRank.THIRD,
    } = executeCmd;

    if (!this.hasConnectedDevice) {
      throw new Error(
        `The device has been disconnected. ${_.get(this.connectInfo, 'port')}`,
      );
    }
    const cmdList = this.converter.generationCommand({
      key: 'DEFAULT',
      value: reqDeviceControlType.MEASURE,
    });
    const cmdName = `${this.config.dataLoggerInfo.dld_target_name} ${
      this.config.dataLoggerInfo.dl_target_code
    } Type: ${wrapCmdType}`;

    const commandSet = this.generationManualCommand({
      wrapCmdUUID,
      cmdList,
      commandId: wrapCmdId,
      commandName: cmdName,
      uuid,
      commandType: wrapCmdType,
      rank,
    });

    this.executeCommand(commandSet);

    // 명령 요청에 문제가 없으므로 현재 진행중인 명령에 추가
    return this.model.addRequestCommandSet(commandSet);
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
    process.env.LOG_DLC_EVENT === '1' && super.updatedDcEventOnDevice(dcEvent);

    const { CONNECT, DISCONNECT } = this.definedControlEvent;

    switch (dcEvent.eventName) {
      case CONNECT:
        this.isConnected = true;
        this.emit(CONNECT);
        break;
      case DISCONNECT:
        // 장치와의 접속이 해제되었을 경우 장치 데이터 및 진행 명령을 초기화
        if (this.isConnected) {
          this.isConnected = false;
          // 장치 데이터 초기화, 명령 초기화
          this.model.initModel();
          // 옵저버에게 데이터 초기화 전파
          this.observerList.forEach(ob => {
            _.get(ob, 'notifyDeviceData') && ob.notifyDeviceData(this, this.nodeList);
          });
        }

        this.emit(DISCONNECT);
        break;
      default:
        break;
    }

    // 이벤트 발송
    this.observerList.forEach(observer => {
      observer.notifyDeviceEvent(this, dcEvent);
    });
  }

  /**
   * @override
   * 장치에서 명령을 수행하는 과정에서 생기는 1:1 이벤트
   * @param {dcError} dcError 현재 장비에서 실행되고 있는 명령 객체
   */
  onDcError(dcError) {
    // BU.CLIN(dcError);
    process.env.LOG_DLC_ERROR === '1' && super.onDcError(dcError);

    const { RETRY, ERROR } = this.definedCommanderResponse;

    // 재시도 횟수 제한에 걸리지 않았다면 재시도
    if (this.commander.isRetryExecute()) {
      return this.requestTakeAction(RETRY);
    }

    // 에러 카운트 증가
    this.errorCount += 1;
    // (config.deviceInfo.protocol_info.protocolOptionInfo.hasTrackingData = true 일 경우 추적하기 때문에 Data를 계속 적재하는 것을 방지함)
    this.converter.resetTrackingDataBuffer();

    // 현재 진행 중인 명령 객체를 삭제 요청
    this.requestTakeAction(ERROR);
    // Observer가 해당 메소드를 가지고 있다면 전송
    this.observerList.forEach(ob => {
      ob.notifyDeviceError(this, dcError);
    });
  }

  /**
   * @override
   * 메시지 발생 핸들러
   * @param {dcMessage} dcMessage
   */
  onDcMessage(dcMessage) {
    process.env.LOG_DLC_MESSAGE === '1' && super.onDcMessage(dcMessage);
    // 명령 완료, 명령 삭제, 지연 명령 대기열로 이동
    const {
      // COMMANDSET_EXECUTION_START,
      COMMANDSET_EXECUTION_TERMINATE,
      COMMANDSET_DELETE,
      COMMANDSET_MOVE_DELAYSET,
    } = this.definedCommandSetMessage;

    let renewalNodeList = [];

    switch (dcMessage.msgCode) {
      // 명령 수행이 완료
      // 현재 데이터 업데이트, 명령 목록에서 해당 명령 제거
      case COMMANDSET_EXECUTION_TERMINATE:
        renewalNodeList = this.model.completeOnData();
        this.model.completeRequestCommandSet(dcMessage.commandSet);
        break;
      case COMMANDSET_DELETE:
        // BU.CLI(this.model.tempStorage);
        this.model.completeRequestCommandSet(dcMessage.commandSet);
        break;
      // 지연 명령 수행 처리.
      // case COMMANDSET_MOVE_DELAYSET:
      //   renewalNodeList = this.model.completeOnData();
      //   break;
      // 명령 목록에서 해당 명령 제거
      // this.model.tempStorage = this.converter.BaseModel;
      // this.model.completeRequestCommandSet(dcMessage.commandSet);
      // break;
      default:
        break;
    }

    // BU.CLIN(this.model.requestCommandSetList);
    // 데이터가 갱신되었다면 Observer에게 알림.
    if (renewalNodeList.length) {
      if (process.env.LOG_DLC_RENEWAL_DATA === '1') {
        const pickedNodeList = _(renewalNodeList)
          .map(node => _.pick(node, ['node_id', 'data']))
          .value();
        BU.CLI(this.id, pickedNodeList);
      }
      this.observerList.forEach(ob => {
        ob.notifyDeviceData(this, renewalNodeList);
      });
    }

    // Observer가 해당 메소드를 가지고 있다면 전송
    this.observerList.forEach(ob => {
      ob.notifyDeviceMessage(this, dcMessage);
    });
  }

  /**
   * 장치로부터 데이터 수신
   * @override
   * @param {dcData} dcData 현재 장비에서 실행되고 있는 명령 객체
   */
  onDcData(dcData) {
    process.env.LOG_DLC_ON_DATA === '1' && super.onDcData(dcData);

    try {
      const { DONE, ERROR, WAIT, RETRY } = this.definedCommanderResponse;
      const { eventCode, data } = this.converter.parsingUpdateData(dcData, this.nodeList);

      // BU.CLI(eventCode, data);

      if (process.env.LOG_DLC_PARSER_DATA === '1') {
        const haveData = [];
        _.forEach(data, (v, key) => {
          v.length > 0 && haveData.push({ [key]: v });
        });
        // BU.CLI(data)
        !_.isEmpty(haveData) && BU.CLI(this.id, haveData);
        // BU.CLI(haveData);
      }

      if (eventCode === WAIT) {
        return;
      }

      // 확실히 오류 데이터가 들어왔다고 판단했을 경우 재전송 요청
      if (eventCode === RETRY) {
        return this.requestTakeAction(RETRY);
      }

      // Retry 시도 시 다중 명령 요청 및 수신이 이루어 지므로 Retry 하지 않음.
      if (eventCode === ERROR) {
        return this.requestTakeAction(WAIT);
      }

      // 데이터가 정상적이라면
      if (eventCode === DONE) {
        // DLC 에러 카운트 초기화
        this.errorCount = 0;
        // Device Client로 해당 이벤트 Code를 보냄
        // 수신 받은 데이터 저장
        this.model.onPartData(data);

        this.requestTakeAction(eventCode, dcData.data);
      }
    } catch (error) {
      BU.logFile(error);
      throw error;
    }
  }
}
module.exports = DataLoggerController;
