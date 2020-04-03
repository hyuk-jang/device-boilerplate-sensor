const _ = require('lodash');
const { BU } = require('base-util-jh');

const {
  dcmConfigModel: {
    cmdStrategyType,
    commandStep: cmdStep,
    commandPickKey,
    reqWrapCmdType: reqWCT,
    reqWrapCmdFormat: reqWCF,
    reqDeviceControlType: reqDCT,
    nodePickKey,
  },
  dccFlagModel: { definedCommandSetRank },
  dcmWsModel: { transmitToServerCommandType: transmitToServerCT },
} = require('../../module').di;

const ManualCmdStrategy = require('./CommandStrategy/ManualCmdStrategy');
const OverlapCountCmdStrategy = require('./CommandStrategy/OverlapCountCmdStrategy');

const CmdStorage = require('./Command/CmdStorage');
const CmdElement = require('./Command/CmdElement');

const CommandUpdator = require('../Updator/CommandUpdator/CommandUpdator');
const OperationModeUpdator = require('../Updator/OperationModeUpdator/OperationModeUpdator');

class CommandManager {
  /** @param {Model} model */
  constructor(model) {
    const { coreFacade, controller, mapCmdInfo, nodeList } = model;

    this.commandUpdator = new CommandUpdator();

    this.coreFacade = coreFacade;
    this.controller = controller;
    this.model = model;

    this.nodeList = nodeList;

    // FIXME:
    /** @type {CmdStorage[]} */
    this.commandList = [];

    /** @type {wsSvgImgInfo[]} */
    this.svgImgList = [];

    this.mapCmdInfo = mapCmdInfo;

    // 명령 전략가 등록
    this.cmdStrategy;

    // 명령 전략 모드 종류
    this.cmdStrategyType = cmdStrategyType;
  }

  init() {
    // 기본 제공되는 명령 전략 세터를 등록한다.
    this.cmdStrategy = new ManualCmdStrategy(this);

    // 구동 모드 옵저버 등록
    this.operationModeUpdator = new OperationModeUpdator(this.coreFacade);
    this.operationModeUpdator.attachObserver(this);
  }

  /** 구동모드 반환 */
  getOperationMode() {
    return this.operationModeUpdator.getOperationMode();
  }

  /**
   * @param {AlgorithmMode} currAlgorithmMode 바뀐 알고리즘 모드
   * @param {AlgorithmMode} prevAlgorithmMode 이전 알고리즘 모드
   *
   */
  updateOperationMode(currAlgorithmMode, prevAlgorithmMode) {
    // BU.CLIN(currAlgorithmMode);
    const { algorithmId, cmdStrategy } = currAlgorithmMode;

    // 명령 전략 교체 요청
    this.changeCmdStrategy(cmdStrategy);

    /** @type {wsModeInfo} */
    const modeInfo = {
      algorithmId,
      operationConfigList: this.coreFacade.coreAlgorithm.getOperationConfigList(),
    };
    // BU.CLI('updateOperationMode', modeInfo);

    this.controller.apiClient.transmitDataToServer({
      commandType: transmitToServerCT.MODE,
      data: modeInfo,
    });
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

    // 명령 전략이 바뀌었다면 기존 추적중인 명령은 모두 삭제
    if (isChanged) {
      this.commandList = [];
      this.controller.apiClient.transmitDataToServer({
        commandType: transmitToServerCT.COMMAND,
        data: [],
      });
    }

    // BU.CLI(isChanged);

    return isChanged;
  }

  /**
   *
   * @param {reqCommandInfo} reqCommandInfo
   * @param {Observer=} observer
   * @return {CmdStorage}
   */
  executeCommand(reqCommandInfo, observer) {
    try {
      const { wrapCmdFormat, wrapCmdType, wrapCmdId, wrapCmdName } = reqCommandInfo;

      // 계측 명령 일 경우에는 전략에 상관없이 요청
      if (wrapCmdFormat === reqWCF.MEASURE) {
        // BU.debugConsole(5);
        // BU.CLI(`executeCommand-${this.controller.mainUUID}`, wrapCmdId);
        // 동일 명령이 존재하는지 체크
        const foundCommand = _.find(this.commandList, { wrapCmdId });

        if (foundCommand) {
          throw new Error(`${foundCommand.wrapCmdName} 명령은 존재합니다.`);
          // throw new Error(`wrapCmdId: ${wrapCmdId} is exist`);
        }

        // 실제 수행할 장치를 정제
        const commandWrapInfo = this.refineReqCommand(reqCommandInfo);

        return this.executeRealCommand(commandWrapInfo);
      }
      // 계측 명령이 아닐 경우 명령 전략에 따라 진행
      process.env.LOG_DBS_CMD_START === '1' &&
        BU.CLI(`(${wrapCmdFormat})(${wrapCmdType}) ${wrapCmdName} [${wrapCmdId}] `);

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
      const cmdStorage = new CmdStorage(this.coreFacade);
      // 옵저버 추가
      // BU.CLIN(observer, 1);
      cmdStorage.attachObserver(observer || this);

      cmdStorage.setCommand(cmdWrapInfo);
      // 명령 목록에 추가
      this.commandList.push(cmdStorage);

      // 실제 장치로 명령 요청하기 전에 cmdStorage를 먼저 반환하기 위함.
      setImmediate(() => cmdStorage.executeCommandFromDLC());

      return cmdStorage;
    } catch (error) {
      throw error;
    }
  }

  /**
   * SVG 화면에 나타낼 Img의 변동이 생겼을 경우 진행중인 이미지 관리를 함
   * @param {mScenarioImgDisplayInfo} svgImgInfo
   */
  updateSvgImg(svgImgInfo) {
    const { imgId, isAppear = 1 } = svgImgInfo;
    // BU.CLI(imgId, isAppear);

    // 새로이 생성하는 이미지이고 중복이 없을 경우 삽입
    if (isAppear === 1) {
      this.svgImgList.findIndex(svgImg => svgImg.imgId === imgId) < 0 &&
        this.svgImgList.push({
          imgId,
        });
    } else {
      _.remove(this.svgImgList, { imgId });
    }
    // BU.CLI(this.svgImgList);

    // BU.CLI(this.model.getAllSvgImg());
    this.controller.apiClient.transmitDataToServer({
      commandType: transmitToServerCT.SVG_IMG,
      data: this.model.getAllSvgImg(),
    });
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

      this.getCmdStorage({ wrapCmdUUID })
        .getCmdEle({ cmdEleUuid: uuid })
        .updateCommand(msgCode);
    } catch (error) {
      // BU.CLIS(wrapCmdUUID, uuid, commandId, nodeId);
      // _.map(this.commandList, cmdStorage => {
      //   BU.CLI(cmdStorage.wrapCmdUUID, cmdStorage.wrapCmdInfo);
      // });
      // BU.CLIN(this.getCmdStorage({ wrapCmdUUID: wrapCmdUUID }).getCmdEle({ cmdEleUuid: uuid }));
      // BU.error(error);
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
    const { wrapCmdFormat, wrapCmdStep, wrapCmdId } = cmdStorage;
    //  명령 완료를 받았을 경우
    if (wrapCmdStep === cmdStep.COMPLETE) {
      this.removeCommandStorage(cmdStorage);
      // 정기 계측 명령일 경우
      if (wrapCmdFormat === reqWCF.MEASURE && wrapCmdId === 'inquiryAllDeviceStatus') {
        this.model.completeInquiryDeviceStatus();
      }
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

    process.env.LOG_DBS_CMD_REMAIN === '1' &&
      BU.CLI(
        _(this.commandList)
          .map(commandStorage => _.pick(commandStorage, commandPickKey.FOR_SERVER))
          .value(),
      );

    this.controller.apiClient.transmitDataToServer({
      commandType: transmitToServerCT.COMMAND,
      // data: [_.pick(cmdStorage, commandPickKey.FOR_SERVER)],
      // data: _.map(this.commandList, cmdStorage => _.pick(cmdStorage, commandPickKey.FOR_SERVER)),
      data: this.model.getAllCmdStatus(commandPickKey.FOR_SERVER),
      // data: _(this.commandList)
      //   .map(commandStorage => _.pick(commandStorage, commandPickKey.FOR_SERVER))
      //   .value(),
    });

    // 명령 업데이트를 구독하고 있는 대상에게 공지
    this.commandUpdator.notifyObserver(cmdStorage);

    this.controller.emit(cmdStorage.cmdStep, cmdStorage);

    // this.controller.apiClient.transmitDataToServer({
    //   commandType: transmitToServerCT.COMMAND,
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
    // BU.CLI(this.controller.mainUUID, reqCmdInfo);

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

  /**
   * @param {nodeInfo} nodeInfo
   * @param {number} singleControlType
   */
  convertControlValueToString(nodeInfo, singleControlType) {
    return this.cmdStrategy.convertControlValueToString(nodeInfo, singleControlType);
  }

  /**
   * 명령상에 있는 장치 제어 중에 이상이 있는 장치 점검. 이상이 있을 경우 수행 불가
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
}
module.exports = CommandManager;
