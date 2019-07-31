const _ = require('lodash');
const { BU } = require('base-util-jh');

const ThreCmdManager = require('./Command/ThresholdCommand/ThreCmdManager');
const CmdOverlapManager = require('./CommandOverlap/CmdOverlapManager');

const ManualCmdStrategy = require('./CommandStrategy/ManualCmdStrategy');
const OverlapCountCmdStrategy = require('./CommandStrategy/OverlapCountCmdStrategy');

const CoreFacade = require('../CoreFacade');

const CmdStorage = require('./Command/CmdStorage');
const CmdElement = require('./Command/CmdElement');

const {
  dcmConfigModel,
  dcmWsModel: { transmitToServerCommandType },
} = CoreFacade;

const {
  complexCmdStep,
  commandStep: cmdStep,
  commandPickKey,
  goalDataRange: goalDR,
  reqWrapCmdType: reqWCT,
  reqWrapCmdFormat: reqWCF,
} = dcmConfigModel;

class CommandManager {
  /** @param {Model} model */
  constructor(model) {
    const { controller, complexCmdList, mapCmdInfo, nodeList } = model;

    this.model = model;
    this.controller = controller;

    this.nodeList = nodeList;

    this.complexCmdList = complexCmdList;

    // FIXME:
    /** @type {CmdStorage[]} */
    this.commandList = [];

    this.mapCmdInfo = mapCmdInfo;

    // 명령 전략가 등록
    this.cmdStrategy;

    // 명령 전략 모드 종류
    this.cmdStrategyType = {
      MANUAL: 'MANUAL',
      OVERLAP_COUNT: 'OVERLAP_COUNT',
      SCENARIO: 'SCENARIO',
    };

    // Command Manager를 Core Facde에 정의
    const coreFacade = new CoreFacade();
    coreFacade.setCmdManager(this);

    this.coreFacade = coreFacade;
  }

  /**
   *
   * @param {reqCommandInfo} reqCommandInfo
   * @param {Observer=} observer
   * @return {CmdStorage}
   */
  executeCommand(reqCommandInfo, observer) {
    try {
      const { wrapCmdFormat, wrapCmdType, wrapCmdId, reqCmdEleList } = reqCommandInfo;

      // 계측 명령 일 경우에는 전략에 상관없이 요청
      if (wrapCmdFormat === reqWCF.MEASURE) {
        // 동일 명령이 존재하는지 체크
        const foundCommand = _.find(this.commandList, { wrapCmdId });

        if (foundCommand) {
          throw new Error(`wrapCmdId: ${wrapCmdId} is exist`);
        }
        // 실제 수행할 장치를 정제
        const commandWrapInfo = this.refineReqCommand(reqCommandInfo);

        return this.executeRealCommand(commandWrapInfo);
      }
      // 계측 명령이 아닐 경우 명령 전략에 따라 진행

      return this.cmdStrategy.executeCommand(reqCommandInfo);
    } catch (error) {
      // BU.error(error.stack);
      // console.error(error)
      BU.error(error.message);
      throw error;
    }
  }

  /**
   *
   * @param {commandWrapInfo} cmdWrapInfo 실제 내릴 명령 객체 정보
   * @param {Observer=}
   */
  executeRealCommand(cmdWrapInfo, observer) {
    try {
      // BU.CLIN(cmdWrapInfo.containerCmdList)
      // 명령 저장소 생성
      const cmdStorage = new CmdStorage();
      // 옵저버 추가
      // BU.CLIN(observer, 1);
      cmdStorage.attachObserver(observer || this);

      cmdStorage.setCommand(cmdWrapInfo);
      // 명령 목록에 추가
      this.commandList.push(cmdStorage);

      // 실제 장치로 명령 요청
      cmdStorage.executeCommandFromDLC();

      return cmdStorage;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 저장소 데이터 관리. Data Logger Controller 객체로 부터 Message를 받은 경우 msgCode에 따라서 관리
   * @example
   * Device Client로부터 Message 수신
   * @param {DataLoggerControl} dataLoggerController Data Logger Controller 객체
   * @param {dcMessage} dcMessage 명령 수행 결과 데이터
   */
  updateCommandMessage(dataLoggerController, dcMessage) {
    const {
      commandSet: { wrapCmdUUID, uuid, commandId, nodeId },
      msgCode,
    } = dcMessage;
    try {
      // BU.CLIN(commandSet);

      this.getCmdStorage({ wrapCmdUuid: wrapCmdUUID })
        .getCmdEle({ cmdEleUuid: uuid })
        .updateCommand(msgCode);
    } catch (error) {
      // _.map(this.commandList, cmdStorage => {
      //   BU.CLI(cmdStorage.wrapCmdUuid, cmdStorage.wrapCmdInfo);
      // });
      // BU.CLIN(this.getCmdStorage({ wrapCmdUuid: wrapCmdUUID }).getCmdEle({ cmdEleUuid: uuid }));
      BU.error(`${commandId} ${nodeId} ${msgCode}`, error.message);
      // NOTE: 명령 삭제 후 발생한 이벤트에 대해서는 무시함.
      // throw error;
    }
  }

  /**
   * Command Storage 에서 명령 상태 이벤트를 수신할 메소드
   *
   * @param {CmdStorage} cmdStorage
   */
  updateCommandStep(cmdStorage) {
    // BU.CLI('updateCommandStep >>> Default', cmdStorage.cmdStep);
    //  명령 완료를 받았을 경우
    if (cmdStorage.cmdStep === cmdStep.COMPLETE) {
      this.removeCommandStorage(cmdStorage);
    }

    this.notifyUpdateCommandStep(cmdStorage);
  }

  /**
   * 명령 단계를 공지
   * Command Storage 에서 명령 상태 이벤트를 수신할 메소드
   * @param {CmdStorage} cmdStorage
   */
  notifyUpdateCommandStep(cmdStorage) {
    // BU.CLI('notifyUpdateCommandStep', cmdStorage.cmdStep);
    // FIXME: 임시. 메시지 전체 보냄
    // BU.CLI(_.pick(cmdStorage, commandPickKey.FOR_SERVER));
    this.controller.apiClient.transmitDataToServer({
      commandType: transmitToServerCommandType.COMMAND,
      // data: [_.pick(cmdStorage, commandPickKey.FOR_SERVER)],
      // data: _.map(this.commandList, cmdStorage => _.pick(cmdStorage, commandPickKey.FOR_SERVER)),
      data: _(this.commandList)
        .map(commandStorage => _.pick(commandStorage, commandPickKey.FOR_SERVER))
        .value(),
    });

    this.controller.emit(cmdStorage.cmdStep, cmdStorage);

    // this.controller.apiClient.transmitDataToServer({
    //   commandType: transmitToServerCommandType.COMMAND,
    //   data: _(cmdStorage).pick(commandPickKey.FOR_SERVER),
    // });
  }

  /**
   *
   * @param {CmdStorage} cmdStorage
   */
  removeCommandStorage(cmdStorage) {
    // BU.CLI('removeCommandStorage', this.commandList.length);
    // 명령 목록에서 제거
    _.pull(this.commandList, cmdStorage);
    // BU.CLI('removeCommandStorage', this.commandList.length);
  }

  /**
   * 존재하지 않는 NodeId 혹은 DataLogger, DLC 접속이 되지 않은 장치는 배제
   * @param {reqCommandInfo} reqCmdInfo
   * @param {boolean=} isThrow 장치와 연결이 되지 않았거나 존재하지 않는 searchIdList가 존재할 경우 throw 여부. 기본 값 default
   * @return {commandWrapInfo}
   */
  refineReqCommand(reqCmdInfo, isThrow = false) {
    // 이상있는 장치는 제거 후 재 저장

    try {
      /** @type {commandContainerInfo[]} */
      const containerCmdList = [];

      reqCmdInfo.reqCmdEleList.forEach(cmdEleInfo => {
        const { searchIdList, controlSetValue, singleControlType } = cmdEleInfo;

        _.forEach(searchIdList, searchId => {
          /** @type {commandContainerInfo} */
          const cmdContainer = {
            singleControlType,
            controlSetValue,
            isIgnore: false,
            nodeId: searchId,
          };
          const dataLoggerController = this.model.findDataLoggerController(searchId);

          let errMsg = '';
          if (isThrow && _.isUndefined(dataLoggerController)) {
            errMsg = `DLC: ${searchId}가 존재하지 않습니다.`;
            throw new Error(errMsg);
            // BU.CLI(errMsg);
          } else if (isThrow && !_.get(dataLoggerController, 'hasConnectedDevice')) {
            errMsg = `${searchId}는 장치와 연결되지 않았습니다.`;
            throw new Error(errMsg);
            // BU.CLI(errMsg);
          } else {
            containerCmdList.push(cmdContainer);
          }
        });
      });

      _.set(reqCmdInfo, 'containerCmdList', containerCmdList);
      // _.set(reqCmdInfo, 'realContainerCmdList', []);
      return reqCmdInfo;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 제어하고자 하는 명령이 존재하거나 현재 상태값과 동일하다면 해당 명령을 제외 처리
   * 제외 처리시 >>> commandContainerInfo.isIgnore = true
   * @param {commandContainerInfo[]} containerCmdList
   */
  calcRestoreContainerCmd(containerCmdList) {}

  /**
   * 제어하고자 하는 명령이 존재하거나 현재 상태값과 동일하다면 해당 명령을 제외 처리
   * 제외 처리시 >>> commandContainerInfo.isIgnore = true
   * @param {commandContainerInfo[]} containerCmdList
   */
  calcDefaultRealContainerCmd(containerCmdList) {
    // BU.CLIN(containerCmdList);
    containerCmdList.forEach(containerInfo => {
      // 마지막으로 실제 제어할 cmdElement를 가져옴
      const foundCmdEle = this.getLastCmdEle(containerInfo);
      // _.assign(containerInfo, { isLive: true });

      // BU.CLIN(foundCmdEle, 1);
      // 기존재할 경우
      if (foundCmdEle instanceof CmdElement) {
        containerInfo.isIgnore = true;
      } else {
        // 현재 값과 제어할려는 값이 동일할 경우 true, 다르다면 false
        containerInfo.isIgnore = this.isEqualCurrNodeData(containerInfo);
      }
    });
  }

  /**
   * @param {commandContainerInfo} containerInfo
   * @example
   * singleControlType
   * 0: Close, Off
   * 1: Open, On
   * undefined, 2: Status
   * 3: Set   --> controlSetValue 가 필수적으로 입력
   */
  isEqualCurrNodeData(containerInfo) {
    // BU.CLI(containerInfo);
    const { nodeId, singleControlType, controlSetValue } = containerInfo;
    // BU.CLI(singleControlType, nodeId);
    const nodeInfo = this.coreFacade.getNodeInfo(nodeId);

    const cmdName = this.convertControlValueToString(nodeInfo, singleControlType);
    // 설정 제어 값이 존재
    if (_.isNil(controlSetValue)) {
      // node 현재 값과 동일하다면 제어 요청하지 않음
      // BU.CLI(_.eq(_.lowerCase(nodeInfo.data), _.lowerCase(cmdName)));
      if (_.eq(_.lowerCase(nodeInfo.data), _.lowerCase(cmdName))) {
        return true;
      }
      // 동일하지 않을 경우
      return false;
    }
    // 설정 값이 존재한다면 그 값과 현재 node 값을 비교
    return _.eq(nodeInfo.data, controlSetValue);
  }

  /**
   *
   * @param {cmdStorageSearch} storageSearchInfo
   * @return {CmdStorage}
   */
  getCmdStorage(storageSearchInfo) {
    // BU.CLI(storageSearchInfo);
    return _.find(this.commandList, storageSearchInfo);
  }

  /**
   * cmdWrapOption으로 Command Stroage를 찾고자 할 경우
   * @param {cmdStorageSearch} storageSearchInfo
   * @return {CmdStorage[]}
   */
  getCmdStorageList(storageSearchInfo) {
    return _.filter(this.commandList, storageSearchInfo);
  }

  /**
   * cmdElementUuid 만으로 Command Element를 찾고자 할 경우
   * @param {cmdElementSearch} cmdElementSearch
   * @return {CmdElement}
   */
  getCmdEle(cmdElementSearch) {
    let commandElement;

    // 명령 객체 목록에서 조회
    _.some(this.commandList, cmdStorage => {
      const cmdElement = cmdStorage.getCmdEle(cmdElementSearch);
      // 찾았을 경우 객체이므로
      commandElement = cmdElement;
      return commandElement;
    });
    return commandElement;
  }

  /**
   * cmdElementSearch 에 맞는 최종적으로 내릴 명령
   * @param {cmdElementSearch} cmdElementSearch
   * @return {CmdElement}
   */
  getLastCmdEle(cmdElementSearch) {
    // BU.CLI(cmdElementSearch);
    const cmdElement = _(this.getCmdEleList(cmdElementSearch))
      .sortBy('rank')
      .head();

    return cmdElement;
  }

  /**
   * cmdWrapOption으로 Command Stroage를 찾고자 할 경우
   * @param {cmdElementSearch} cmdElementSearch
   * @return {CmdElement[]}
   */
  getCmdEleList(cmdElementSearch) {
    // BU.CLIN(this.commandList);
    const result = _(this.commandList)
      .map(cmdStorage => cmdStorage.getCmdEleList(cmdElementSearch))
      .flatten()
      .value();
    // BU.CLIN(result);
    return result;
  }

  init() {
    // 임계치 명령을 관리할 매니저 등록
    this.threCmdManager = new ThreCmdManager(this);

    // 명령 누적을 관리할 매니저 등록
    this.cmdOverlapManager = new CmdOverlapManager(this);

    // 기본 제공되는 명령 전략 세터를 등록한다.
    this.cmdStrategy = new ManualCmdStrategy(this);
  }

  /** 제어모드 반환 */
  getControMode() {
    return this.controller.controlModeUpdator.getControlMode();
  }

  /** 명령 전략이 수동인지 자동인지 여부 */
  getCurrCmdStrategyType() {
    const { MANUAL, OVERLAP_COUNT } = this.cmdStrategyType;

    let currMode;

    if (this.cmdStrategy instanceof ManualCmdStrategy) {
      currMode = MANUAL;
    } else if (this.cmdStrategy instanceof OverlapCountCmdStrategy) {
      currMode = OVERLAP_COUNT;
    }

    return currMode;
  }

  /**
   * 제어모드가 변경되었을 경우 값에 따라 Command Manager를 교체
   * @param {string} cmdMode 자동 명령 모드 여부
   */
  changeCmdStrategy(cmdMode) {
    // BU.CLI('changeCmdStrategy', cmdMode);
    let isChanged = false;

    const { MANUAL, OVERLAP_COUNT } = this.cmdStrategyType;

    switch (cmdMode) {
      case MANUAL:
        // BU.CLI(this.cmdStrategy instanceof ManualCmdStrategy);
        isChanged = !(this.cmdStrategy instanceof ManualCmdStrategy);
        isChanged && (this.cmdStrategy = new ManualCmdStrategy(this));
        break;
      case OVERLAP_COUNT:
        isChanged = !(this.cmdStrategy instanceof OverlapCountCmdStrategy);
        isChanged && (this.cmdStrategy = new OverlapCountCmdStrategy(this));
        break;
      default:
        break;
    }

    // BU.CLI(isChanged);

    return isChanged;
  }

  /**
   * @param {nodeInfo} nodeInfo
   * @param {number} singleControlType
   */
  convertControlValueToString(nodeInfo, singleControlType) {
    return this.cmdStrategy.convertControlValueToString(nodeInfo, singleControlType);
  }

  /**
   * ID를 기준으로 실행중인 명령을 가져온다
   * @param {string} wrapCmdId Complex Wrap Command Id
   * @return {complexCmdWrapInfo}
   */
  getComplexCommand(wrapCmdId) {
    return _.find(this.complexCmdList, { wrapCmdId });
  }

  /**
   * 조건에 맞는 흐름 명령 반환
   * @param {string} srcPlaceId 출발 장소 ID
   * @param {string} destPlaceId 도착 장소 ID
   */
  getFlowCommand(srcPlaceId = '', destPlaceId = '') {
    // BU.CLIS(srcPlaceId, destPlaceId);
    return _.find(this.complexCmdList, { srcPlaceId, destPlaceId });
  }

  /**
   * 조건에 맞는 흐름 명령 반환
   * @param {string=} srcPlaceId 출발 장소 ID
   * @param {string=} destPlaceId 도착 장소 ID
   * @param {string=} wrapCmdType 명령 타입 CONTROL, CANCEL
   * @return {complexCmdWrapInfo[]}
   */
  getFlowCommandList(srcPlaceId = '', destPlaceId = '', wrapCmdType) {
    // BU.CLIS(srcPlaceId, destPlaceId);
    const whereInfo = { wrapCmdFormat: reqWCF.FLOW };
    if (_.isString(wrapCmdType)) {
      whereInfo.wrapCmdType = wrapCmdType;
    }

    // 염수 이동 명령의 시작지와 도착지의 정보 유무에 따라 where 절 생성
    _.isString(srcPlaceId) && srcPlaceId.length && _.assign(whereInfo, { srcPlaceId });
    _.isString(destPlaceId) && destPlaceId.length && _.assign(whereInfo, { destPlaceId });

    return _.filter(this.complexCmdList, whereInfo);
  }

  /**
   * 복합 명령을 저장
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdWrapInfo}
   */
  saveComplexCommand(complexCmdWrapInfo) {
    try {
      const {
        wrapCmdType,
        wrapCmdId,
        wrapCmdGoalInfo: { goalDataList } = {},
        containerCmdList,
      } = complexCmdWrapInfo;

      // BU.error('saveComplexCommand', wrapCmdId);
      // BU.CLI(complexCmdWrapInfo);

      const cmdName = `wrapCmdId: ${wrapCmdId}, wrapCmdType: ${wrapCmdType}`;
      // ComplexCommandList에서 동일 Wrap Command Id 가 존재하는지 체크
      // BU.CLI(this.complexCmdList);
      if (_.find(this.complexCmdList, { wrapCmdType, wrapCmdId })) {
        throw new Error(`${cmdName} is exist`);
      }

      // 요청한 명령이 현재 모드에서 실행 가능한지 체크. 처리가 불가능 하다면 예외 발생
      this.cmdStrategy.isPossibleSaveComplexCommand(complexCmdWrapInfo);

      // 계측 명령이라면 실제 제어목록 산출하지 않음
      if (wrapCmdType === reqWCT.MEASURE) {
        complexCmdWrapInfo.realContainerCmdList = containerCmdList;
      } else {
        // 제어하고자 하는 장치 중에 이상있는 장치 여부 검사
        if (!this.isNormalOperation(containerCmdList)) {
          throw new Error(`An abnormal device exists among the ${cmdName}`);
        }

        // 실제 제어할 명령 리스트 산출
        const realContainerCmdList = this.cmdStrategy.produceRealControlCommand(complexCmdWrapInfo);

        // BU.CLI(realContainerCmdList);

        // if (wrapCmdType === reqWrapCmdType.RESTORE) {
        //   BU.CLI(realContainerCmdList);
        // }
        // 실제 명령이 존재하지 않을 경우 종료
        if (!realContainerCmdList.length) {
          throw new Error(`${cmdName} real CMD list does not exist.`);
        }

        // 실제 수행하는 장치 제어 목록 정의
        complexCmdWrapInfo.realContainerCmdList = realContainerCmdList;

        // BU.CLI(complexCmdWrapInfo)

        // 복합 명령 csOverlapControlStorage 반영
        this.cmdOverlapManager.updateOverlapCmdWrapInfo(complexCmdWrapInfo);
      }

      // BU.error('WAIT SETTING', wrapCmdId);

      complexCmdWrapInfo.wrapCmdStep = complexCmdStep.WAIT;

      // 명령 취소가 요청이 정상적으로 처리되었다면 기존 제어 명령은 제거 처리
      if (wrapCmdType === reqWCT.CANCEL) {
        // 명령이 존재하는 index 조회
        const foundIndex = _.findIndex(this.complexCmdList, {
          wrapCmdId,
          wrapCmdType: reqWCT.CONTROL,
        });

        // 만약 Threshold Goal가 존재한다면 제거
        this.threCmdManager.removeThreCmdStorage(this.complexCmdList[foundIndex]);

        // 기존 복합 명령 제거
        _.pullAt(this.complexCmdList, [foundIndex]);
        // _.remove(this.complexCmdList, { wrapCmdId, wrapCmdType: reqWrapCmdType.CONTROL });
      }

      // 명령을 요청한 시점에서의 제어 모드
      complexCmdWrapInfo.controlMode = this.getControMode();

      this.complexCmdList.push(complexCmdWrapInfo);

      // 명령 스택이 정상적으로 처리되었으므로 API Client에게 전송
      this.model.transmitComplexCommandStatus();

      return complexCmdWrapInfo;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 저장소 데이터 관리. Data Logger Controller 객체로 부터 Message를 받은 경우 msgCode에 따라서 관리
   * @example
   * Device Client로부터 Message 수신
   * @param {DataLoggerControl} dataLoggerController Data Logger Controller 객체
   * @param {dcMessage} dcMessage 명령 수행 결과 데이터
   */
  manageComplexCommand(dataLoggerController, dcMessage) {
    const {
      COMMANDSET_EXECUTION_START,
      COMMANDSET_EXECUTION_TERMINATE,
      COMMANDSET_DELETE,
    } = dataLoggerController.definedCommandSetMessage;

    // BU.CLIN(dcMessage);

    // DLC commandId, commandType은 각각 wrapCmdId, wrapCmdType과 매칭됨
    const {
      commandSet: {
        commandId: dcWrapCmdId,
        commandType: dcWrapCmdType,
        wrapCmdUUID: dcWrapCmdUUID,
        uuid: dcCmdUUID,
      },
      msgCode: dcMsgCode,
    } = dcMessage;

    // BU.CLIN(dcMessage.commandSet, 1);

    /** @type {complexCmdWrapInfo} */
    const wrapCmdInfo = _.find(this.complexCmdList, { wrapCmdUUID: dcWrapCmdUUID });

    // 통합 명령 UUID가 없을 경우
    if (!wrapCmdInfo) {
      // BU.CLI(this.complexCmdList);
      throw new Error(`dcWrapCmdId: ${dcWrapCmdId} ${dcWrapCmdType} is not exist.`);
    }

    const {
      wrapCmdStep,
      wrapCmdId,
      wrapCmdName,
      wrapCmdType,
      wrapCmdGoalInfo,
      containerCmdList,
      realContainerCmdList,
    } = wrapCmdInfo;

    // DC Message: COMMANDSET_EXECUTION_START && complexCmdStep !== WAIT ===> Change PROCEED Step
    // DCC 명령이 수행중
    if (_.eq(dcMsgCode, COMMANDSET_EXECUTION_START) && _.eq(wrapCmdStep, complexCmdStep.WAIT)) {
      wrapCmdInfo.wrapCmdStep = complexCmdStep.PROCEED;
      // 상태 변경된 명령 목록 API Server로 전송
      return this.model.transmitComplexCommandStatus();
    }

    // 명령 코드가 완료(COMMANDSET_EXECUTION_TERMINATE), 삭제(COMMANDSET_DELETE)가 아니라면 종료
    if (!_.includes([COMMANDSET_EXECUTION_TERMINATE, COMMANDSET_DELETE], dcMsgCode)) return false;

    // DLC에서 수신된 메시지가 명령 완료, 명령 삭제 완료 중 하나 일 경우
    // 실제 제어 컨테이너 안에 있는 Ele 요소 중 dcUUID와 동일한 개체 조회
    const flattenEleCmdList = _(realContainerCmdList)
      .map('eleCmdList')
      .flatten()
      .value();

    // FIXME: Ele가 존재하지 않는다면 명령 삭제 처리 필요 (DCC Error 로 넘어가게됨.)
    if (!flattenEleCmdList.length) {
      throw new Error(`wrapCmdId(${dcWrapCmdId}) does not exist in the Complex Command List.`);
    }

    // dcCmdUUID가 동일한 Complex Command를 찾음
    const eleCmdInfo = _.find(flattenEleCmdList, { uuid: dcCmdUUID });

    // Ele가 존재하지 않는다면 명령 스택에서 없는 것으로 판단
    if (!eleCmdInfo) {
      // BU.CLI(wrapCmdInfo);
      return BU.logFile(`dcCmdUUID(${dcCmdUUID}) does not exist in the Complex Command List.`);
      // throw new Error(`dcCmdUUID(${dcCmdUUID}) does not exist in the Complex Command List.`);
    }

    // 해당 단위 명령 완료 처리
    eleCmdInfo.hasComplete = true;

    // 계측 명령이 아닐 경우 단위 명령 추적 삭제.
    if (wrapCmdType !== reqWCT.MEASURE) {
      // Overlap Status Reserverd Element Command UUID 모두 삭제
      this.cmdOverlapManager.getOverlapStatusWithECU(dcCmdUUID).forEach(overlapStatus => {
        overlapStatus.resetReservedECU();
      });
    }

    // 모든 장치의 제어가 완료됐다면
    if (_.every(flattenEleCmdList, 'hasComplete')) {
      // BU.log(`M.UUID: ${this.controller.mainUUID || ''}`, `Complete: ${wrapCmdId} ${wrapCmdType}`);

      // 명령 완료 처리
      this.cmdStrategy.completeComplexCommand(wrapCmdInfo);

      // FIXME: 수동 자동? 처리?
      // foundComplexCmdInfo.wrapCmdStep = complexCmdStep.RUNNING;
      // this.transmitComplexCommandStatus();

      if (wrapCmdId === 'inquiryAllDeviceStatus') {
        // BU.CLI('Comlete inquiryAllDeviceStatus');
        this.controller.emit('completeInquiryAllDeviceStatus', dcWrapCmdId);
        this.model.completeInquiryDeviceStatus();
      } else {
        // FIXME: 일반 명령 completeCommand이 완료되었을 경우 처리할 필요가 있다면 작성
        this.controller.emit('completeCommand', wrapCmdInfo);
        // this.controller.emit('completeCommand', foundComplexCmdInfo);
      }
    }
  }

  /**
   * 명령상에 있는 장치 제어 중에 이상이 있는 장치 점검. 이상이 있을 경우 수행 불가
   * @param {complexCmdContainerInfo[]} containerCmdList
   */
  isNormalOperation(containerCmdList) {
    // 제어하고자 하는 모든 장치를 순회하며 이상 여부를 점검.
    return _.every(containerCmdList, containerCmdInfo => {
      const { eleCmdList } = containerCmdInfo;
      const result = _.every(eleCmdList, eleCmdInfo => {
        const foundDataLoggerController = this.model.findDataLoggerController(eleCmdInfo.nodeId);
        // 데이터로거가 존재하고 해당 데이터 로거가 에러 상태가 아닐 경우 True
        return _.isObject(foundDataLoggerController) && !foundDataLoggerController.isErrorDLC;
      });
      // BU.CLI(result);
      return result;
    });
  }

  /**
   * 명령 목표치 달성 여부 체크
   * @param {Object[]} cmdGoalDataList 해당 명령을 통해 얻고자 하는 값 목록
   * @param {string} cmdGoalDataList.nodeId 달성하고자 하는 nodeId
   * @param {string|number} cmdGoalDataList.goalValue 달성 기준치 값
   * @param {number} cmdGoalDataList.goalRange 기준치 인정 범위.
   * @return {boolean}
   */
  isAchieveCommandGoal(cmdGoalDataList) {}
}
module.exports = CommandManager;
