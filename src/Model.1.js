const _ = require('lodash');
const moment = require('moment');

const { BU } = require('base-util-jh');
const { BM } = require('base-model-jh');

const ControlDBS = require('./Control');

const { dcmWsModel, dcmConfigModel } = require('../../default-intelligence');

const {
  reqWrapCmdType,
  complexCmdStep,
  contractCmdStep,
  nodePickKey,
  nodeDataType,
} = dcmConfigModel;

const { transmitToServerCommandType } = dcmWsModel;

// const NODE_DATA = ['node_seq', 'data', 'writeDate'];

// const map = require('../config/map');

class Model {
  /**
   * Creates an instance of Model.
   * @param {ControlDBS} controller
   * @memberof Model
   */
  constructor(controller) {
    this.controller = controller;

    const { config, dataLoggerControllerList, dataLoggerList, nodeList } = controller;

    this.dataLoggerControllerList = dataLoggerControllerList;
    this.dataLoggerList = dataLoggerList;
    this.nodeList = nodeList;

    // 복합 명령 저장소를 초기화
    this.initComplexCmdStorage();

    /** @type {complexCmdWrapInfo[]} 복합 명령 실행 목록 */
    this.complexCmdList = [];

    /** @type {contractCmdInfo[]} 복합 명령 축약 Ver 목록 */
    this.contractCmdList = [];

    this.biModule = new BM(config.dbInfo);

    // 정기 조회 Count
    this.inquirySchedulerIntervalSaveCnt = _.get(config, 'inquirySchedulerInfo.intervalSaveCnt', 1);
    this.inquirySchedulerCurrCount = 0;

    this.deviceMap = controller.deviceMap;

    // FIXME: 임시로 자동 명령 리스트 넣어둠. DB에서 가져오는 걸로 수정해야함(2018-07-30)
    this.excuteControlList = _.get(this.deviceMap, 'controlInfo.tempControlList', []);
  }

  /**
   * 복합 명령 저장소를 초기화
   */
  initComplexCmdStorage() {
    /** @type {complexCmdIntegratedStorage} */
    const complexStorage = {
      controlStorage: {
        waitingList: [],
        proceedingList: [],
        runningList: [],
      },
      cancelStorage: {
        waitingList: [],
        proceedingList: [],
      },
      measureStorage: {
        waitingList: [],
        proceedingList: [],
      },
    };
    this.complexCmdIntegratedStorage = complexStorage;
  }

  /**
   * 신규 contractCmdInfo가 생성되었을 경우
   * @param {contractCmdInfo} contractCmdInfo
   * @return {boolean} 정상적인 신규 데이터 삽입이 이루어지면 true, 아니면 false
   */
  addContractCommand(contractCmdInfo) {
    const foundIt = _.find(this.contractCmdList, { uuid: contractCmdInfo.uuid });
    // 기존에 없을 경우에만 삽입
    if (!foundIt) {
      // 신규 삽입
      this.contractCmdList.push(contractCmdInfo);

      // 신규 알림
      this.controller.apiClient.transmitDataToServer({
        commandType: transmitToServerCommandType.COMMAND,
        data: [contractCmdInfo],
      });
      return true;
    }
    return false;
  }

  /**
   * 기존에 존재하던 명령의 수정이 이루어 질때
   * @param {string} uuid
   * @param {string} strComplexCmdStep complexCmdStep
   * @return {boolean} 갱신이 이루어지면 true, 아니면 false
   */
  updateContractCommand(uuid, strComplexCmdStep) {
    const contractCmdInfo = _.find(this.contractCmdList, { uuid });
    // BU.CLI(complexCmdStep, contractCmdInfo);
    // 데이터가 존재하고 이전 Contract Step과 다를 경우 갱신 처리
    if (
      contractCmdInfo &&
      _(contractCmdStep)
        .values()
        .includes(strComplexCmdStep) &&
      !_.isEqual(contractCmdInfo.complexCmdStep, strComplexCmdStep)
    ) {
      contractCmdInfo.complexCmdStep = strComplexCmdStep;

      // 명령이 완료됐다면 Contract Command List에서 삭제
      strComplexCmdStep === contractCmdStep.COMPLETE &&
        _.pullAllWith(this.contractCmdList, [contractCmdInfo], _.isEqual);

      // 업데이트 알림 (통째로 보내버림)
      this.controller.apiClient.transmitDataToServer({
        commandType: transmitToServerCommandType.COMMAND,
        data: this.contractCmdList,
      });
      return true;
    }
    return false;
  }

  /**
   * API 서버로 축약해서 명령을 보냄.
   */
  transmitComplexCommandStatus() {
    const contractCommandList = _.map(this.complexCmdList, _.omit('containerCmdList'));
    // 업데이트 알림 (통째로 보내버림)
    this.controller.apiClient.transmitDataToServer({
      commandType: transmitToServerCommandType.COMMAND,
      data: contractCommandList,
    });
  }

  /**
   *
   * @param {Object} findOption
   */
  getComplexCommand(findOption) {
    // return _.find(this.complexCmdList, { wrapCmdUUID });
  }

  /**
   * 명령을 기반으로 Order Storage 내용 반환
   * @param {string} wrapCmdUUID 명령을 내릴 때 해당 명령의 고유 ID(mode5, mode3, ...)
   */
  findAllComplexCmdByStorageUUID(wrapCmdUUID) {
    const returnValue = {
      complexCmdIntegratedStorageKey: '',
      /** @type {complexCmdStorage} */
      complexCmdStorage: {},
      complexCmdStorageStepKey: '',
      wrapCmdListIndex: -1,
      /** @type {complexCmdWrapInfo[]} */
      wrapCmdList: [],
      /** @type {complexCmdWrapInfo} */
      wrapCmdInfo: {},
    };

    const hasFined = false;
    // 저장소를 순회
    _.forEach(this.complexCmdIntegratedStorage, (complexCmdStorage, cmdStep) => {
      if (hasFined) return false;
      // 각 저장소의 대기, 진행, 실행 목록 순회
      _.forEach(complexCmdStorage, (complexCmdWrapList, strCmdStorageStep) => {
        if (hasFined) return false;
        // 해당 명령을 가진 complexCmdWrapInfo 검색
        const foundIndex = _.findIndex(complexCmdWrapList, {
          wrapCmdUUID,
        });
        // 0 이상이면 해당 배열에 존재한다는 것
        if (foundIndex >= 0) {
          returnValue.complexCmdIntegratedStorageKey = cmdStep;
          returnValue.complexCmdStorage = complexCmdStorage;
          returnValue.complexCmdStorageStepKey = strCmdStorageStep;
          returnValue.wrapCmdListIndex = foundIndex;
          returnValue.wrapCmdList = complexCmdWrapList;
          returnValue.wrapCmdInfo = _.nth(complexCmdWrapList, foundIndex);
        }
      });
    });

    return returnValue;
  }

  /**
   * UUID에 해당하는 Order Storage 내용 반환
   * @param {string} cmdEleUUID UUID. 유일 키로 명령 요청 시 동적으로 생성 및 부여
   */
  findAllComplexCmdByElementInfo(cmdEleUUID) {
    const returnValue = {
      complexCmdIntegratedStorageKey: '',
      /** @type {complexCmdStorage} */
      complexCmdStorage: {},
      complexCmdStorageStepKey: '',
      /** @type {complexCmdWrapInfo[]} */
      wrapCmdList: [],
      /** @type {complexCmdWrapInfo} */
      wrapCmdInfo: {},
      /** @type {complexCmdContainerInfo} */
      containerCmdInfo: {},
      /** @type {complexCmdEleInfo} */
      eleCmdInfo: {},
    };

    let hasFined = false;
    // 저장소를 순회
    _.forEach(this.complexCmdIntegratedStorage, (complexCmdStorage, complexStorageType) => {
      if (hasFined) return false;
      // 각 저장소의 대기, 진행, 실행 목록 순회
      _.forEach(complexCmdStorage, (complexCmdWrapList, strCmdStorageStep) => {
        if (hasFined) return false;
        // 저장소에 저장된 명령 리스트 목록 순회
        _.forEach(complexCmdWrapList, complexCmdWrapInfo => {
          if (hasFined) return false;
          // 제어 목록별 명령 순회
          _.forEach(complexCmdWrapInfo.containerCmdList, containerCmdInfo => {
            if (hasFined) return false;
            // 해당 ID를 가진 complexCmdWrapInfo 검색
            const foundIt = _.find(containerCmdInfo.eleCmdList, { uuid: cmdEleUUID });
            if (foundIt) {
              hasFined = true;
              returnValue.complexCmdIntegratedStorageKey = complexStorageType;
              returnValue.complexCmdStorage = complexCmdStorage;
              returnValue.complexCmdStorageStepKey = strCmdStorageStep;
              returnValue.wrapCmdList = complexCmdWrapList;
              returnValue.wrapCmdInfo = complexCmdWrapInfo;
              returnValue.containerCmdInfo = containerCmdInfo;
              returnValue.eleCmdInfo = foundIt;
            }
          });
        });
      });
    });

    return returnValue;
  }

  /**
   * @desc Find Step 1
   * 명령 요청에 따라 '제어', '취소', '계측' 저장소 리스트 반환
   * @param {string} complexCmdIntegratedStorageType CONTROL, CANCEL, MEASURE
   * @return {complexCmdStorage}
   */
  findComplexCmdStorage(complexCmdIntegratedStorageType) {
    //
    const { controlStorage, cancelStorage, measureStorage } = this.complexCmdIntegratedStorage;
    let complexCmd;
    switch (complexCmdIntegratedStorageType) {
      case reqWrapCmdType.CONTROL:
        complexCmd = controlStorage;
        break;
      case reqWrapCmdType.CANCEL:
        complexCmd = cancelStorage;
        break;
      case reqWrapCmdType.MEASURE:
        complexCmd = measureStorage;
        break;
      default:
        complexCmd = measureStorage;
        break;
    }

    return complexCmd;
  }

  /**
   * Data logger와 연결되어 있는 컨트롤러를 반환
   * @param {dataLoggerInfo|string} searchValue string: dl_id, node_id or Object: DataLogger
   */
  findDataLoggerController(searchValue) {
    // BU.CLI(searchValue);
    // Node Id 일 경우
    if (_.isString(searchValue)) {
      // Data Logger List에서 찾아봄
      // BU.CLIN(this.dataLoggerList);
      const dataLoggerInfo = _.find(this.dataLoggerList, {
        dl_id: searchValue,
      });

      if (dataLoggerInfo) {
        searchValue = dataLoggerInfo;
      } else {
        // 없다면 노드에서 찾아봄
        const nodeInfo = _.find(this.nodeList, {
          node_id: searchValue,
        });
        // string 인데 못 찾았다면 존재하지 않음. 예외 발생
        if (_.isEmpty(nodeInfo)) {
          throw new Error(`Node ID: ${searchValue} is not exist`);
        }
        searchValue = nodeInfo.getDataLogger();
      }
    }

    // BU.CLIN(this.dataLoggerControllerList);
    return _.find(this.dataLoggerControllerList, router =>
      _.isEqual(router.dataLoggerInfo, searchValue),
    );
  }

  /**
   * 저장소 데이터 관리. Data Logger Controller 객체로 부터 Message를 받은 경우 msgCode에 따라서 관리
   * @example
   * Device Client로부터 Message 수신
   * @param {DataLoggerControl} dataLoggerController Data Logger Controller 객체
   * @param {dcMessage} dcMessage 명령 수행 결과 데이터
   */
  manageComplexStorage(dataLoggerController, dcMessage) {
    const {
      COMMANDSET_EXECUTION_START,
      COMMANDSET_EXECUTION_TERMINATE,
      COMMANDSET_DELETE,
    } = dataLoggerController.definedCommandSetMessage;

    // BU.CLIN(dcMessage);

    const {
      commandSet: {
        commandId: dcWrapCmdId,
        commandType: dcWrapCmdType,
        wrapCmdUUID: dcWrapCmdUUID,
        uuid: dcCmdUUID,
      },
      msgCode: dcMsgCode,
    } = dcMessage;

    const foundComplexCmdInfo = _.find(this.complexCmdList, { wrapCmdUUID: dcWrapCmdUUID });

    // 통합 명령 UUID가 없을 경우
    if (!foundComplexCmdInfo) {
      throw new Error(`wrapCmdUUID: ${dcWrapCmdUUID} is not exist.`);
    }

    const {
      wrapCmdStep,
      wrapCmdId,
      wrapCmdName,
      wrapCmdType,
      containerCmdList,
    } = foundComplexCmdInfo;

    // DC Message: COMMANDSET_EXECUTION_START && complexCmdStep !== WAIT ===> Change PROCEED Step
    // DCC 명령이 수행중
    if (_.eq(dcMsgCode, COMMANDSET_EXECUTION_START)) {
      if (_.eq(wrapCmdStep, complexCmdStep.WAIT)) {
        foundComplexCmdInfo.wrapCmdStep = complexCmdStep.PROCEED;
        // 상태 변경된 명령 목록 API Server로 전송
        this.transmitComplexCommandStatus();
      }
      return true;
    }

    // 명령 코드가 완료(COMMANDSET_EXECUTION_TERMINATE), 삭제(COMMANDSET_DELETE)가 아니라면 종료
    if (!_.includes([COMMANDSET_EXECUTION_TERMINATE, COMMANDSET_DELETE], dcMsgCode)) return false;

    // DLC에서 수신된 메시지가 명령 완료, 명령 삭제 완료 중 하나 일 경우
    // 컨테이너 안에 있는 Ele 요소 중 dcUUID와 동일한 개체 조회
    const allComplexEleCmdList = _(containerCmdList)
      .map('eleCmdList')
      .flatten()
      .value();

    // FIXME: Ele가 존재하지 않는다면 명령 삭제 처리 필요
    if (!allComplexEleCmdList.length) {
      throw new Error(`wrapCmdId(${dcWrapCmdId}) does not exist in the Complex Command List.`);
    }

    // dcCmdUUID가 동일한 Complex Command를 찾음
    const foundEleInfo = _.find(allComplexEleCmdList, { uuid: dcCmdUUID });

    // Ele가 존재하지 않는다면 종료
    if (!foundEleInfo) {
      throw new Error(`dcCmdUUID(${dcCmdUUID}) does not exist in the Complex Command List.`);
    }

    // 해당 단위 명령 완료 처리
    foundEleInfo.hasComplete = true;

    // 모든 장치의 제어가 완료됐다면
    if (_.every(allComplexEleCmdList, 'hasComplete')) {
      BU.CLI(`M.UUID: ${this.controller.mainUUID || ''}`, `Complete CMD: ${wrapCmdId}`);

      // FIXME: 수동 자동? 처리?
      foundComplexCmdInfo.wrapCmdStep = complexCmdStep.RUNNING;
      this.transmitComplexCommandStatus();

      if (wrapCmdId === 'inquiryAllDeviceStatus') {
        // BU.CLI('Comlete inquiryAllDeviceStatus');
        this.controller.emit('completeInquiryAllDeviceStatus', dcWrapCmdId);
        this.completeInquiryDeviceStatus();
      } else {
        // FIXME: 일반 명령 completeCommand이 완료되었을 경우 처리할 필요가 있다면 작성
        this.controller.emit('completeCommand', dcWrapCmdId);
      }
    }
  }

  /**
   * 저장소 데이터 관리. Data Logger Controller 객체로 부터 Message를 받은 경우 msgCode에 따라서 관리
   * @example
   * Device Client로부터 Message 수신
   * @param {DataLoggerController} dataLoggerController Data Logger Controller 객체
   * @param {dcMessage} dcMessage 명령 수행 결과 데이터
   */
  manageComplexStorage2(dataLoggerController, dcMessage) {
    const {
      COMMANDSET_EXECUTION_START,
      COMMANDSET_EXECUTION_TERMINATE,
      COMMANDSET_DELETE,
    } = dataLoggerController.definedCommandSetMessage;

    const {
      commandSet: {
        commandId: dcCommandId,
        commandType: dcCommandType,
        wrapCmdUUID: dcIntegratedUUID,
        uuid: dcUuid,
      },
      msgCode: dcMsgCode,
    } = dcMessage;

    // 명령 타입에 따라서 저장소를 가져옴(Control, Cancel, Measure)

    const {
      complexCmdIntegratedStorageKey,
      complexCmdStorageStepKey,
      complexCmdStorage,
      wrapCmdList,
      wrapCmdListIndex,
      wrapCmdInfo,
    } = this.findAllComplexCmdByStorageUUID(dcIntegratedUUID);

    // Storage UUID와 일치하는 Complex CMD Storage가 없을 경우
    if (!complexCmdIntegratedStorageKey.length) {
      // BU.CLIN(resComplexStorageInfo);
      throw new Error(`wrapCmdType: ${dcCommandType} is not exist.`);
    }

    // ComplexCmdWrapInfo 가 없을 경우
    if (_.isEmpty(wrapCmdInfo)) {
      throw new Error(`wrapCmdId: ${dcCommandId} is not exist.`);
    }

    // 복합 명령 현황 저장소 key 형태를 보고 명령 타입을 정의
    // TODO: complexStorageType에 따라 명령 요청, 취소 요청 처리 필요
    // let complexStorageType = '';
    // switch (complexCmdIntegratedStorageKey) {
    //   case 'controlStorage':
    //     complexStorageType = reqWrapCmdType.CONTROL;
    //     break;
    //   case 'cancelStorage':
    //     complexStorageType = reqWrapCmdType.CANCEL;
    //     break;
    //   case 'measureStorage':
    //     complexStorageType = reqWrapCmdType.MEASURE;
    //     break;
    //   default:
    //     break;
    // }

    // BU.CLIN(commandSet);
    // BU.CLIN(commandId, uuid);

    // 명령 코드가 COMMANDSET_EXECUTION_START 이고 아직 complexCmdStep.WAIT 상태라면 PROCEEDING 상태로 이동하고 종료
    if (
      dcMsgCode === COMMANDSET_EXECUTION_START &&
      complexCmdStorageStepKey === complexCmdStep.WAIT
    ) {
      BU.CLI(`${this.controller.mainUUID} ${wrapCmdInfo.wrapCmdId} 작업 시작`);
      // watingList에서 해당 명령 제거. pullAt은 배열 형태로 리턴하므로 첫번째 인자 가져옴.
      const complexCmdWrapInfo = _.head(
        _.pullAt(wrapCmdList, wrapCmdListIndex),
        // _.pullAt(complexCmdStorage[complexCmdStorageStepKey], wrapCmdListIndex),
      );
      // Wating CMD Wrap 이 없을 경우
      if (complexCmdWrapInfo === undefined) {
        throw new Error('해당 객체는 존재하지 않습니다.');
      }

      // 진행중 명령 저장소 목록에 삽입
      complexCmdStorage.proceedingList.push(complexCmdWrapInfo);
      // contractCmdList 갱신
      this.updateContractCommand(wrapCmdInfo.wrapCmdUUID, contractCmdStep.PROCEED);
      return false;
    }

    // 명령 코드가 완료(COMMANDSET_EXECUTION_TERMINATE), 삭제(COMMANDSET_DELETE) 일 경우
    const completeKeyList = [COMMANDSET_EXECUTION_TERMINATE, COMMANDSET_DELETE];
    // 작업 완료로 교체
    if (completeKeyList.includes(dcMsgCode)) {
      // BU.CLI(
      //   '작업 완료',
      //   `${wrapCmdInfo.wrapCmdId} ${nodeId}`,
      // );
      // orderElement를 가져옴

      // singleControlType에 상관없이 flatten 형태로 모두 가져옴
      const flatOrderElementList = _(wrapCmdInfo.containerCmdList)
        .map('eleCmdList')
        .flatten()
        .value();

      // 가져온 flatten 리스트에서 uuid가 동일한 객체 검색
      // const orderElementInfo = _.find(flatOrderElementList, {
      //   uuid: uuid,
      // });

      _.set(
        _.find(flatOrderElementList, {
          uuid: dcUuid,
        }),
        'hasComplete',
        true,
      );

      // BU.CLI('NodeID', orderElementInfo.nodeId);

      // 완료 처리
      // if (orderElementInfo) {
      //   orderElementInfo.hasComplete = true;
      //   // NOTE: 한개의 동작이 완료 됐을 때 특별한 동작을 하고 싶을 경우 이하 작성
      // }

      // TEST: 작업 세부 과정의 최종 완료 여부를 콘솔에서 확인하기 위해 간단히 가져옴
      // const flatSimpleList = _.map(flatOrderElementList, ele =>
      //   _.pick(ele, ['hasComplete', 'nodeId']),
      // );
      // BU.CLI(wrapCmdInfo.wrapCmdId, flatSimpleList);

      // 모든 장치의 제어가 완료됐다면
      if (_.every(flatOrderElementList, 'hasComplete')) {
        BU.CLI(`M.UUID: ${this.controller.mainUUID || ''}`, `Complete CMD: ${dcCommandId}`);
        // proceedingList에서 제거
        const completeCommandInfo = _.head(_.pullAt(wrapCmdList, wrapCmdListIndex));
        // Proceeding CMD Wrap 이 없을 경우
        if (completeCommandInfo === undefined) {
          throw new Error('해당 객체는 존재하지 않습니다.');
        }

        if (wrapCmdInfo.wrapCmdId === 'inquiryAllDeviceStatus') {
          // BU.CLI('Comlete inquiryAllDeviceStatus');
          this.controller.emit('completeInquiryAllDeviceStatus', dcCommandId);
          this.completeInquiryDeviceStatus();
        } else {
          // FIXME: 일반 명령 completeCommand이 완료되었을 경우 처리할 필요가 있다면 작성
          this.controller.emit('completeCommand', dcCommandId);
        }

        // FIXME: 명령 제어에 대한 자세한 논리가 나오지 않았기 때문에 runningList로 이동하지 않음. (2018-07-23)
        // FIXME: RUNNING 리스트 없이 무조건 완료 처리함. 실행 중인 명령을 추적하고자 할경우 추가적인 논리 필요
        this.updateContractCommand(wrapCmdInfo.wrapCmdUUID, contractCmdStep.COMPLETE);

        // 명령 제어 요청일 경우 runningList로 이동
        // if (commandType === wrapCmdType.CONTROL) {
        //   complexCmdStorage.runningList.push(completeCommandInfo);
        // }

        // BU.CLI(complexCmdStorage);

        // TODO: 명령이 모두 완료 되었을 때 하고 싶은 행동 이하 작성
      }

      // TODO: DB 입력
    }

    // // Message에 따라서 행동 개시
    // switch (dcMsgCode) {
    //   case COMMANDSET_EXECUTION_START:
    //     complexCmdKey === complexCmdStep.WAIT ?
    //       case this.definedCommandSetMessage.COMMANDSET_EXECUTION_TERMINATE:
    //   case this.definedCommandSetMessage.COMMANDSET_DELETE:
    //     // BU.CLIN(this.model.requestCommandSetList);
    //     this.model.completeRequestCommandSet(commandSet);
    //     // Observer가 해당 메소드를 가지고 있다면 전송
    //     // this.observerList.forEach(observer => {
    //     //   if (_.get(observer, 'notifyCompleteOrder')) {
    //     //     observer.notifyCompleteOrder(this, commandSet);
    //     //   }
    //     // });
    //     // BU.CLIN(this.model.requestCommandSetList);
    //     break;
    //   default:
    //     break;
    // }
  }

  /** 정기 계측 조회 명령 완료 결과 반영 */
  async completeInquiryDeviceStatus() {
    process.env.LOG_DBS_INQUIRY_COMPLETE === '1' &&
      BU.CLI(`${this.controller.mainUUID} Comlete inquiry`);

    // 정기 계측 카운팅 증가
    this.inquirySchedulerCurrCount += 1;

    // 정기 계측 저장 간격 수와 현재 수행된 정기 계측 명령 수가 같지 않다면 데이터 저장 X
    // 1분당 간격이 아닌 더 적은 인터벌 계측이 이루어 질 경우
    if (this.inquirySchedulerIntervalSaveCnt !== this.inquirySchedulerCurrCount) {
      return false;
    }

    // 현재 정기 계측된 카운팅 초기화
    this.inquirySchedulerCurrCount = 0;

    // 데이터의 유효성을 인정받는 Node List
    const validNodeList = this.checkValidateNodeData(
      this.nodeList,
      _.get(this, 'config.inquirySchedulerInfo.validInfo'),
      this.controller.inquirySchedulerRunMoment,
      // momentDate.format('YYYY-MM-DD HH:mm:ss'),
    );

    // BU.CLIN(validNodeList);
    if (process.env.LOG_DBS_INQUIRY_RESULT === '1') {
      BU.CLI(this.getAllNodeStatus(nodePickKey.FOR_DATA));
    }

    await this.insertNodeDataToDB(validNodeList, {
      hasSensor: process.env.DBS_SAVE_SENSOR !== '0',
      hasDevice: process.env.DBS_SAVE_DEVICE !== '0',
    });
  }

  /**
   * 복합 명령을 저장
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {boolean} 명령을 등록한다면 true, 아니라면 false
   */
  saveComplexCmd(complexCmdWrapInfo) {
    complexCmdWrapInfo.wrapCmdStep = complexCmdStep.WAIT;

    this.complexCmdList.push(complexCmdWrapInfo);
  }

  /**
   * 복합 명령을 저장
   * @param {string} wrapCmdType 저장할 타입 CONTROL, CANCEL
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {boolean} 명령을 등록한다면 true, 아니라면 false
   */
  saveComplexCmd2(wrapCmdType = reqWrapCmdType.MEASURE, complexCmdWrapInfo) {
    // BU.CLI('saveComplexCmd');

    // 아무런 명령을 내릴 것이 없다면 등록하지 않음
    // BU.CLI(complexCmdWrapInfo.containerCmdList);
    const hasNonCommand = _.every(
      complexCmdWrapInfo.containerCmdList,
      info => info.eleCmdList.length === 0,
    );
    if (hasNonCommand) {
      return false;
    }
    /**
     * Socket Server로 전송하기 위한 명령 추가 객체 생성
     * @type {contractCmdInfo}
     */
    const contractCmd = {
      reqWrapCmdType: wrapCmdType,
      complexCmdStep: contractCmdStep.NEW,
      commandId: complexCmdWrapInfo.wrapCmdId,
      commandName: complexCmdWrapInfo.wrapCmdName,
      uuid: complexCmdWrapInfo.wrapCmdUUID,
    };

    const { CONTROL, CANCEL, MEASURE } = reqWrapCmdType;

    let storage;
    switch (wrapCmdType) {
      case CONTROL:
        storage = this.complexCmdIntegratedStorage.controlStorage;
        break;
      case CANCEL:
        storage = this.complexCmdIntegratedStorage.cancelStorage;
        break;
      case MEASURE:
      default:
        storage = this.complexCmdIntegratedStorage.measureStorage;
        break;
    }

    storage.waitingList.push(complexCmdWrapInfo);
    // 새로 생성된 명령 추가
    this.addContractCommand(contractCmd);
    // BU.CLIN(this.complexCmdIntegratedStorage, 5);
    return true;
  }

  /**
   * 모든 노드가 가지고 있는 정보 출력
   * @param {nodePickKey} nodePickKeyList
   * @param {nodeInfo[]=} nodeList
   * @param {number[]=} targetSensorRange 보내고자 하는 센서 범위를 결정하고 필요 데이터만을 정리하여 반환
   */
  getAllNodeStatus(nodePickKeyList = nodePickKey.FOR_SERVER, nodeList = this.nodeList) {
    const orderKey = _.includes(nodePickKeyList, 'node_id') ? 'node_id' : _.head(nodePickKeyList);

    const statusList = _(nodeList)
      .map(nodeInfo => {
        if (nodePickKeyList) {
          return _.pick(nodeInfo, nodePickKeyList);
        }
        return nodeInfo;
      })
      .orderBy(orderKey)
      .value();
    // BU.CLI(statusList);
    return statusList;
  }

  /**
   * 노드 리스트 중 입력된 날짜를 기준으로 유효성을 가진 데이터만 반환
   * @param {nodeInfo[]} nodeList
   * @param {timeIntervalToValidateInfo} diffInfo
   * @param {moment.Moment} momentDate
   * @return {nodeInfo[]}
   */
  checkValidateNodeData(
    nodeList,
    diffInfo = { diffType: 'minutes', duration: 1 },
    momentDate = moment(),
  ) {
    // 입력된 노드 리스트를 돌면서 유효성 검증
    return nodeList.filter(nodeInfo => {
      // 날짜 차 계산
      const diffNum = momentDate.diff(moment(nodeInfo.writeDate), diffInfo.diffType);
      // 날짜 차가 허용 범위를 넘어섰다면 유효하지 않는 데이터
      if (diffNum > diffInfo.duration) {
        // BU.CLI(
        //   `${
        //     nodeInfo.node_id
        //   }는 날짜(${diffType}) 차이가 허용 범위(${permitValue})를 넘어섰습니다. ${diffNum}`,
        // );
        return false;
      }
      // momentDate.format('YYYY-MM-DD HH:mm:ss'),
      return true;
    });
  }

  /**
   * DB에 데이터 삽입
   * @param {nodeInfo[]} nodeList 노드 리스트
   * @param {{hasSensor: boolean, hasDevice: boolean}} insertOption DB에 입력 처리 체크
   */
  async insertNodeDataToDB(nodeList, insertOption = { hasSensor: false, hasDevice: false }) {
    const { DEVICE, SENSOR } = nodeDataType;
    const { FOR_DB } = nodePickKey;
    const returnValue = [];
    try {
      if (insertOption.hasSensor) {
        const nodeSensorList = _(nodeList)
          .filter(ele => ele.save_db_type === SENSOR && _.isNumber(ele.data))
          .map(ele => BU.renameObj(_.pick(ele, FOR_DB), 'data', 'num_data'))
          .value();
        // BU.CLI(nodeSensorList);
        const result = await this.biModule.setTables('dv_sensor_data', nodeSensorList, false);
        returnValue.push(result);
      }

      // 장치류 삽입
      if (insertOption.hasDevice) {
        const nodeDeviceList = _(nodeList)
          .filter(ele => ele.save_db_type === DEVICE && _.isString(ele.data))
          .map(ele => BU.renameObj(_.pick(ele, FOR_DB), 'data', 'str_data'))
          .value();

        // BU.CLI(nodeDeviceList);
        const result = await this.biModule.setTables('dv_device_data', nodeDeviceList, false);
        returnValue.push(result);
      }
    } catch (error) {
      BU.errorLog('insertNodeDataToDB', error);
      return returnValue;
    }

    // BU.CLIN(nodeList);
    // BU.CLIS(insertOption, insertOption.hasSensor, insertOption.hasDevice);
    // 센서류 삽입
    return returnValue;
  }
}
module.exports = Model;
