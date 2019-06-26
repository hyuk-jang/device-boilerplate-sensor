const _ = require('lodash');
const { BU } = require('base-util-jh');

const CmdStrategySetter = require('./CmdStrategySetter');
const ThreCmdManager = require('./ThresholdCommand/ThreCmdManager');
const CmdOverlapManager = require('./CommandOverlap/CmdOverlapManager');

const ManualCmdStrategy = require('./CommandStrategy/ManualCmdStrategy');
const AutoCmdStrategy = require('./CommandStrategy/AutoCmdStrategy');

const CoreFacade = require('../CoreFacade');

const { dcmWsModel, dcmConfigModel } = require('../../../../default-intelligence');

const {
  complexCmdStep,
  nodePickKey,
  complexCmdPickKey,
  controlModeInfo,
  goalDataRange,
  nodeDataType,
  reqWrapCmdType,
  reqWrapCmdFormat,
  reqDeviceControlType,
} = dcmConfigModel;

class CommandManager {
  /** @param {Model} model */
  constructor(model) {
    const { controller, complexCmdList, mapCmdInfo, nodeList } = model;

    this.model = model;
    this.controller = controller;

    this.nodeList = nodeList;

    this.complexCmdList = complexCmdList;

    this.mapCmdInfo = mapCmdInfo;

    // 명령 전략가 등록
    this.cmdStrategy;

    // Command Manager를 Core Facde에 정의
    const coreFacade = new CoreFacade();
    coreFacade.setCmdManager(this);
  }

  init() {
    // 임계치 명령을 관리할 매니저 등록
    this.threCmdManager = new ThreCmdManager(this);

    // 명령 누적을 관리할 매니저 등록
    this.cmdOverlapManager = new CmdOverlapManager(this);

    // 기본 제공되는 명령 전략 세터를 등록한다.
    this.cmdStrategy = new ManualCmdStrategy(this);

    // this.cmdStrategySetter = new CmdStrategySetter(this);
    // 제어 모드가 변경될 경우 수신 받을 옵저버 추가
    // this.controller.controlModeUpdator.attachObserver(this);
  }

  // /**
  //  * cmdSetter를 교체할 경우
  //  * @param {CmdSetter} cmdSetter
  //  */
  // setCmdSetter(cmdSetter) {
  //   this.cmdStrategySetter = cmdSetter;
  // }

  /** 제어모드 반환 */
  getControMode() {
    return this.controller.controlModeUpdator.getControlMode();
  }

  /** 명령 전략이 수동인지 자동인지 여부 */
  isManualCmdStrategy() {
    return this.cmdStrategy instanceof ManualCmdStrategy;
  }

  /**
   * 제어모드가 변경되었을 경우 값에 따라 Command Manager를 교체
   * @param {number} isAutomatic 자동 명령 모드 여부
   */
  changeCmdStrategy(isAutomatic) {
    let isChanged = false;
    // 자동 모드로 변경
    if (isAutomatic) {
      if (this.cmdStrategy instanceof ManualCmdStrategy) {
        this.cmdStrategy = new AutoCmdStrategy(this);
        isChanged = true;
      }
    } else if (this.cmdStrategy instanceof AutoCmdStrategy) {
      this.cmdStrategy = new ManualCmdStrategy(this);
      isChanged = true;
    }
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
   */
  getFlowCommandList(srcPlaceId = '', destPlaceId = '') {
    // BU.CLIS(srcPlaceId, destPlaceId);
    const whereInfo = { wrapCmdFormat: reqWrapCmdFormat.FLOW };

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
      if (wrapCmdType === reqWrapCmdType.MEASURE) {
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
      if (wrapCmdType === reqWrapCmdType.CANCEL) {
        // 명령이 존재하는 index 조회
        const foundIndex = _.findIndex(this.complexCmdList, {
          wrapCmdId,
          wrapCmdType: reqWrapCmdType.CONTROL,
        });

        // 만약 CC가 존재한다면 제거

        this.threCmdManager.removeThreCmdStorage(this.complexCmdList[foundIndex]);

        // 기존 복합 명령 제거
        _.pullAt(this.complexCmdList, [foundIndex]);
        // _.remove(this.complexCmdList, { wrapCmdId, wrapCmdType: reqWrapCmdType.CONTROL });
      }

      // 명령을 요청한 시점에서의 제어 모드
      complexCmdWrapInfo.controlMode = this.controller.controlModeUpdator.controlMode;

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
      throw new Error(`wrapCmdUUID: ${dcWrapCmdUUID} is not exist.`);
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
    if (wrapCmdType !== reqWrapCmdType.MEASURE) {
      // Overlap Status Reserverd Element Command UUID 모두 삭제
      this.cmdOverlapManager.getOverlapStatusWithECU(dcCmdUUID).forEach(overlapStatus => {
        overlapStatus.resetReservedECU();
      });
    }

    // 모든 장치의 제어가 완료됐다면
    if (_.every(flattenEleCmdList, 'hasComplete')) {
      BU.log(`M.UUID: ${this.controller.mainUUID || ''}`, `Complete: ${wrapCmdId} ${wrapCmdType}`);

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
