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

    /** 명령 진행 상태 WAIT, PROCEED, RUNNING, END, CANCELING  */
    this.cmdStep = '';

    /** @type {CmdElement[]} */
    this.cmdElements = [];

    /** @type {ThreCmdStorage} */
    this.thresholdStorage;

    // 명령 초기화는 한번만 할 수 있음

    _.once(this.setCommand);
    _.once(this.cancelCommand);
  }

  /**
   * 최초 명령을 설정할 경우
   * @param {commandWrapInfo} cmdWrapInfo
   */
  setCommand(cmdWrapInfo) {
    try {
      const { wrapCmdFormat, wrapCmdId, wrapCmdGoalInfo, containerCmdList } = cmdWrapInfo;
      // 명령 취소일 경우
      if (wrapCmdFormat === reqWCT.CANCEL) {
        throw new Error(`initCommand Error: ${wrapCmdId} is CANCEL`);
      }

      // this.cmdStep = cmdStep.WAIT;

      // 명령 객체 정보 저장
      this.cmdWrapInfo = cmdWrapInfo;

      // 실제 제어할 목록 만큼 실행
      this.setCommandElements(containerCmdList);

      // 명령 임계 설정
      // this.setThreshold(wrapCmdGoalInfo);

      // 명령 대기 상태로 전환
      this.updateCommandEvent(cmdStep.WAIT);

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
      // this.cmdStep = cmdStep.WAIT;

      // 세부 명령 객체 정의
      this.setCommandElements(realContainerCmdList);
      // 임계 추적 삭제
      this.removeThreshold();

      // 임계 추적 정의
      this.setThreshold(wrapCmdGoalInfo);

      // 명령 취소 상태로 전환
      this.updateCommandEvent(cmdStep.WAIT);

      // 취소 명령 요청 실행
      this.executeCommandFromDLC();
    } catch (error) {
      throw error;
    }
  }

  /**
   * 현재 수행 중인 명령을 복원
   * @description True 장치를 False 로 교체
   */
  restoreCommand() {}

  /** Data Logger Controller에게 명령 실행 요청 */
  executeCommandFromDLC() {
    BU.CLI('executeCommandFromDLC', this.cmdStep);
    // 명령 단계가 대기 중 일경우에만 요청 가능.
    if (this.cmdStep === cmdStep.WAIT) {
      // this.cmdStep = cmdStep.PROCEED;

      // 무시하는 개체를 제외하고 검색
      _(this.cmdElements)
        .filter({ isIgnore: false })
        .forEach(cmdEle => cmdEle.executeCommandFromDLC());

      // this.cmdElements.forEach(cmdEle => {
      //   cmdEle.executeCommandFromDLC();
      // });
    }
  }

  /**
   * 세부 명령 실행 객체 목록 생성
   * @param {commandContainerInfo[]} commandContainerList
   */
  setCommandElements(commandContainerList) {
    this.cmdElements = [];

    commandContainerList.forEach(containerInfo => {
      const cmdElement = new CmdElement(containerInfo);
      cmdElement.setSuccessor(this);

      this.cmdElements.push(cmdElement);
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
    // BU.CLI('notifyObserver', this.cmdStep);
    this.observers.forEach(observer => {
      if (_.get(observer, 'updateCommandEvent')) {
        observer.updateCommandEvent(this);
      }
    });
  }

  /**
   * 명령 이벤트가 발생되었을 경우
   * @param {string} updatedStorageStep 명령 저장소에 적용될 cmdStep
   */
  updateCommandEvent(updatedStorageStep) {
    // BU.CLI(updatedStorageStep);
    // 이벤트 목록에 부합되는지 확인
    const isExistEvent = _.chain(cmdStep)
      .values()
      .includes(updatedStorageStep)
      .value();

    // 정해진 Event 값이 아니면 종료
    // BU.CLI(isExistEvent);
    if (!isExistEvent) return false;

    // 현재 명령 단계가 대기 단계이고 새로이 수신된 단계가 진행 중일 경우
    // BU.CLI('@@@');
    // if (updatedStorageStep === cmdStep.PROCEED) {
    //   if (this.cmdStep !== cmdStep.WAIT) {
    //     return false;
    //   }
    //   this.cmdStep = updatedStorageStep;
    //   return this.notifyObserver();
    // }

    // 현재 이벤트와 다른 상태일 경우 전파
    if (this.cmdStep !== updatedStorageStep) {
      this.cmdStep = updatedStorageStep;
      return this.notifyObserver();
    }
  }

  /** @return {string} 명령 형식, SINGLE, SET, FLOW, SCENARIO */
  get wrapCmdUuid() {
    return this.cmdWrapUuid;
  }

  /** @return {string} 명령 형식, SINGLE, SET, FLOW, SCENARIO */
  get wrapCmdFormat() {
    return this.cmdWrapInfo.wrapCmdFormat;
  }

  /** @return {string} 명령 타입, CONTROL, CANCEL, RESTORE, MEASURE */
  get wrapCmdType() {
    return this.cmdWrapInfo.wrapCmdType;
  }

  /** @return {string} 명령 ID */
  get wrapCmdId() {
    return this.cmdWrapInfo.wrapCmdId;
  }

  /** @return {string} 명령 이름 */
  get wrapCmdName() {
    return this.cmdWrapInfo.wrapCmdName;
  }

  /** @return {string} 명령 실행 우선 순위 */
  get rank() {
    return this.cmdWrapInfo.rank;
  }

  /** @return {csCmdGoalContraintInfo} 임계 정보 */
  get wrapCmdGoalInfo() {
    return this.cmdWrapInfo.wrapCmdGoalInfo;
  }

  /** @return {string} 명령 진행 상태 WAIT, PROCEED, RUNNING, END, CANCELING */
  get wrapCmdStep() {
    return this.cmdStep;
  }

  /**
   * 옵션에 맞는 명령 Element 개체 1개 반환
   * @param {cmdElementSearch} cmdElementSearch
   * @return {CmdElement}
   */
  getCmdEle(cmdElementSearch) {
    return _.find(this.cmdElements, cmdElementSearch);
  }

  /**
   * 옵션에 맞는 명령 Element 개체 목록 반환
   * @param {cmdElementSearch} cmdElementSearch
   * @return {CmdElement[]}
   */
  getCmdEleList(cmdElementSearch) {
    // BU.CLI(cmdElementSearch);
    return _.filter(this.cmdElements, cmdElementSearch);
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
    // BU.CLI(_.map(this.cmdElements, 'cmdEleStep'));

    // BU.CLIN(this.cmdElements);
    return _.every(this.cmdElements, child => child.isCommandClear());
  }

  /**
   * @param {CmdElement} cmdElement
   *  세부 명령이 완료했을 경우
   */
  handleCommandClear(cmdElement) {
    // BU.CLI(cmdElement.cmdEleUuid, cmdElement.cmdEleStep);
    // 모든 세부 명령이 완료되었을 경우
    if (this.isCommandClear()) {
      // 임계 명령이 존재할 경우
      if (this.setThreshold(this.wrapCmdGoalInfo)) {
        // 명령 목표 달성 진행 중
        return this.updateCommandEvent(cmdStep.RUNNING);
      }

      // 명령 종료
      this.updateCommandEvent(cmdStep.END);
      // 명령 관리자에게 완전 종료를 알림
      // return this.cmdManager.handleCommandClear();
    }

    // 명령을 취소하고 있는 상태
    // if (this.wrapCmdType === reqWCT.CANCEL) {
    //   return this.updateCommandEvent(cmdStep.CANCELING);
    // }
    // 진행 중 상태
    return this.updateCommandEvent(cmdStep.PROCEED);
  }
}
module.exports = CmdStorage;
