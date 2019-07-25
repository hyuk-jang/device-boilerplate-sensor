const _ = require('lodash');

const uuidv4 = require('uuid/v4');

const { BU } = require('base-util-jh');

const CoreFacade = require('../../CoreFacade');

const {
  dcmConfigModel: {
    reqWrapCmdFormat: reqWCF,
    reqWrapCmdType: reqWCT,
    placeNodeStatus: pNS,
    goalDataRange: goalDR,
    commandEvent: cmdEvent,
    commandStep: cmdStep,
  },
} = CoreFacade;

const CmdComponent = require('./CmdComponent');
const CmdElement = require('./CmdElement');

const ThreCmdStorage = require('./ThresholdCommand/ThreCmdStorage');

class CmdStorage extends CmdComponent {
  /**
   *
   */
  constructor() {
    super();

    this.cmdWrapUuid = uuidv4();

    this.cmdWrapInfo;

    this.cmdManager;

    /** @type {CmdElement[]} */
    this.cmdElements = [];

    /** @type {ThreCmdStorage} */
    this.thresholdStorage;

    // 명령 초기화는 한번만 할 수 있음

    // 명령 이벤트를 받을 옵저버
    this.cmdEventObservers = [];

    _.once(this.executeCommand);
    _.once(this.cancelCommand);
  }

  /**
   * 최초 명령을 설정할 경우
   * @param {reqCommandInfo} cmdWrapInfo
   * @param {Observer[]} observers 명령의 실행 결과를 받을 옵저버
   */
  executeCommand(cmdWrapInfo, observers = []) {
    try {
      const { wrapCmdFormat, wrapCmdId, wrapCmdGoalInfo, reqCmdEleList } = cmdWrapInfo;
      // 명령 취소일 경우
      if (wrapCmdFormat === reqWCT.CANCEL) {
        throw new Error(`initCommand Error: ${wrapCmdId} is CANCEL`);
      }

      // 이벤트를 받을 옵저버 정의
      this.cmdEventObservers = observers;

      this.cmdStep = cmdStep.WAIT;

      // 명령 객체 정보 저장
      this.cmdWrapInfo = cmdWrapInfo;

      // 실제 제어할 목록 만큼 실행
      this.setCommandElements(reqCmdEleList);

      // 명령 임계 설정
      // this.setThreshold(wrapCmdGoalInfo);

      // 명령 대기 상태로 전환
      this.updateCommandEvent(cmdEvent.WAIT);

      // 명령 요청 실행
      // this.executeCommandFromDLC();
    } catch (error) {
      throw error;
    }
  }

  /**
   * 명령을 취소할 경우
   * @param {commandWrapInfo} cmdWrapInfo
   */
  cancelCommand(cmdWrapInfo) {
    try {
      const { wrapCmdFormat, wrapCmdId, wrapCmdGoalInfo, realContainerCmdList } = cmdWrapInfo;
      // 명령 취소일 경우
      if (wrapCmdFormat !== reqWCT.CANCEL) {
        throw new Error(`cancelCommand Error: ${wrapCmdId} is CANCEL`);
      }
      // 명령 객체 정보 교체
      this.cmdWrapInfo = cmdWrapInfo;
      // 명령 단계를 대기 상태로 교체
      this.cmdStep = cmdStep.WAIT;

      // 세부 명령 객체 정의
      this.setCommandElements(realContainerCmdList);
      // 임계 추적 삭제
      this.removeThreshold();

      // 임계 추적 정의
      this.setThreshold(wrapCmdGoalInfo);

      // 명령 취소 상태로 전환
      this.updateCommandEvent(cmdEvent.CANCELING);

      // 취소 명령 요청 실행
      this.executeCommandFromDLC();
    } catch (error) {
      throw error;
    }
  }

  /** Data Logger Controller에게 명령 실행 요청 */
  executeCommandFromDLC() {
    // 명령 단계가 대기 중 일경우에만 요청 가능.
    if (this.cmdStep === cmdStep.WAIT) {
      this.cmdStep = cmdStep.PROCEED;

      this.cmdElements.forEach(cmdEle => {
        cmdEle.executeCommandFromDLC();
      });
    }
  }

  /**
   * 세부 명령 실행 객체 목록 생성
   * @param {CommandContainerInfo[]} commandContainerList
   */
  setCommandElements(commandContainerList) {
    this.cmdElements = [];

    commandContainerList.forEach(containerInfo => {
      const { singleControlType, controlSetValue, nodeIdList } = containerInfo;

      nodeIdList.forEach(nodeId => {
        const cmdElement = new CmdElement({
          nodeId,
          singleControlType,
          controlSetValue,
        });
        cmdElement.setSuccessor(this);

        this.cmdElements.push(cmdElement);
      });
    });
  }

  /**
   * 임계 추적 설정.
   * @description cmdStep.COMPLETE 되었을 경우 동작
   * @param {csCmdGoalContraintInfo} wrapCmdGoalInfo
   */
  setThreshold(wrapCmdGoalInfo = {}) {
    // BU.CLI('addThreCmdStorage');
    const { goalDataList = [], limitTimeSec } = wrapCmdGoalInfo;

    // 임계치가 존재하지 않을 경우 임계 설정 하지 않음
    if (!_.isNumber(limitTimeSec) && goalDataList.length === 0) {
      return false;
    }

    // 누적 임계가 실행되는 것 방지를 위한 초기화
    this.removeThreshold();

    // 새로운 임계치 저장소 생성
    const threCmdStorage = new ThreCmdStorage(wrapCmdGoalInfo);
    // 매니저를 Successor로 등록
    threCmdStorage.setSuccessor(this);

    threCmdStorage.initThreCmd(wrapCmdGoalInfo);

    // 임계치 추적 저장소 추가
    this.thresholdStorage = threCmdStorage;

    return true;
  }

  /**
   * Threshold Command Storage에 걸려있는 임계치 타이머 삭제 및 Observer를 해제 후 삭제 처리
   */
  removeThreshold() {
    // 해당 임계치 없다면 false 반환
    if (_.isEmpty(this.thresholdStorage)) return false;

    // 임계 추적 제거
    this.thresholdStorage.resetThreshold();

    // 임계 추적 초기화
    this.thresholdStorage = {};
  }

  /** 명령 이벤트 발생 전파  */
  notifyObserver() {
    this.cmdEventObservers.forEach(observer => {
      if (_.get(observer, 'updateCommandEvent')) {
        observer.updateCommandEvent(this);
      }
    });
  }

  /**
   * 명령 이벤트가 발생되었을 경우
   * @param {string} updatedCmdEvent
   */
  updateCommandEvent(updatedCmdEvent) {
    // 이벤트 목록에 부합되는지 확인
    const isExistEvent = _.chain(cmdEvent)
      .values()
      .includes(updatedCmdEvent)
      .value();

    if (!isExistEvent) return false;

    // 현재 이벤트와 다른 상태일 경우 전파
    if (this.cmdEvent !== updatedCmdEvent) {
      this.cmdEvent = updatedCmdEvent;
      this.notifyObserver();
    }
  }

  /** @return {string} 명령 유일 UUID */
  getCmdWrapUuid() {
    return this.cmdWrapUuid;
  }

  /** @return {commandWrapInfo} 명령 요청 객체 정보 */
  getCmdWrapInfo() {
    return this.cmdWrapInfo;
  }

  /** @return {string} 명령 형식, SINGLE, SET, FLOW, SCENARIO */
  getCmdWrapFormat() {
    return this.cmdWrapInfo.CmdWrapFormat;
  }

  /** @return {string} 명령 타입, CONTROL, CANCEL, RESTORE, MEASURE */
  getCmdWrapType() {
    return this.cmdWrapInfo.CmdWrapType;
  }

  /** @return {string} 명령 ID */
  getCmdWrapId() {
    return this.cmdWrapInfo.CmdWrapId;
  }

  /** @return {string} 명령 이름 */
  getCmdWrapName() {
    return this.cmdWrapInfo.CmdWrapName;
  }

  /** @return {number} 명령 실행 우선 순위 */
  getCmdWrapRank() {
    return this.cmdWrapInfo.rank;
  }

  /** @return {csCmdGoalContraintInfo} 명령 실행 우선 순위 */
  getCmdWrapThreshold() {
    return this.cmdWrapInfo.wrapCmdGoalInfo;
  }

  /**
   *
   * @param {string} cmdEleUuid
   */
  getCommandElement(cmdEleUuid) {
    return _.find(this.cmdElements, { cmdEleUuid });
  }

  /**
   * handleCommandClear 성공하였을 경우 알릴 Successor. Command Manager
   * @param {CommandComponent} cmdManager
   */
  setSuccessor(cmdManager) {
    this.cmdManager = cmdManager;
  }

  /** 모든 세부 명령 완료 여부 */
  isCommandClear() {
    // 모든 세부 명령 처리 여부
    return _.every(this.cmdElements, child => child.isCommandClear());
  }

  /** 세부 명령이 완료했을 경우 */
  handleCommandClear() {
    // 모든 세부 명령이 완료되었을 경우
    if (this.isCommandClear()) {
      // 임계 명령이 존재할 경우
      if (this.setThreshold(this.getCmdWrapThreshold())) {
        // 명령 목표 달성 진행 중
        return this.updateCommandEvent(cmdEvent.RUNNING);
      }

      // 명령 종료
      this.updateCommandEvent(cmdEvent.END);
      // 명령 관리자에게 완전 종료를 알림
      return this.cmdManager.handleCommandClear();
    }
    return this.updateCommandEvent(cmdEvent.PROCEED);
  }
}
module.exports = CmdStorage;
