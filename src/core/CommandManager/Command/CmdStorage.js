const _ = require('lodash');

const uuid = require('uuid');

const { BU } = require('base-util-jh');

const {
  dcmConfigModel: { commandStep: cmdStep, reqWrapCmdType: reqWCT },
} = require('../../../module').di;

const CmdComponent = require('./CmdComponent');
const CmdElement = require('./CmdElement');

const ThreCmdStorage = require('./ThresholdCommand/ThreCmdStorage');
const ThreCmdGoal = require('./ThresholdCommand/ThreCmdGoal');

class CmdStorage extends CmdComponent {
  /**
   * @param {CoreFacade} coreFacade
   */
  constructor(coreFacade) {
    super();
    this.coreFacade = coreFacade;

    this.cmdStorageUuid = uuid.v4();

    this.wrapCmdInfo;

    /**
     * 명령 실행 단계
     * WAIT: 명령이 대기열에 올라가있는 리스트, 아직 장치 제어 요청이 일어나기 전
     * PROCEED: 명령이 진행되었을 경우
     * COMPLETE: 명령 요청 처리가 완료되었을 경우
     * RUNNING: COMPLETE 처리가 되었지만 지켜보고자 할 경우, (Goal 달성 및 실행 중 명령으로 둘 경우 )
     * CANCELING: 종전에 요청한 명령을 DLC에 취소를 요청하는 중
     * RESTORE: CANCELING 완료 후 복원 명령이 있을 경우 해당 명령의 완료를 기다리는 경우
     * END: 명령의 종료할 경우.(Goal 달성 및 삭제)
     */
    this.cmdStep = '';

    /** @type {CmdElement[]} 장치에 명령을 요청 및 관리하는 객체 */
    this.cmdElements = [];

    /** @type {commandContainerInfo[]} CANCELING 처리 후 복원할 명령 목록 */
    this.restoreCmdList = [];

    /** @type {ThreCmdStorage} */
    this.thresholdStorage;

    // 명령 초기화는 한번만 할 수 있음

    _.once(this.setCommand);
    _.once(this.cancelCommand);
  }

  /**
   * 최초 명령을 설정할 경우
   * @param {commandWrapInfo} wrapCmdInfo
   */
  setCommand(wrapCmdInfo) {
    // 명령 객체 정보 저장
    this.wrapCmdInfo = wrapCmdInfo;
    const { containerCmdList } = wrapCmdInfo;

    // 실제 제어할 목록 만큼 실행
    this.setCommandElements(containerCmdList);
  }

  /**
   * 명령을 취소할 경우. DLC로 진행되지 않은 명령은 취소.
   * cmdElements정리 및 임계치 존재 시 제거
   * 복원 명령 존재 시 요청
   * @param {commandContainerInfo[]} restoreCmdList 복원 명령 목록
   */
  cancelCommand(restoreCmdList = []) {
    if (_.isEmpty(this.wrapCmdInfo)) {
      throw new Error('wrapCmdInfo does not exist.');
    }

    // 취소 상태로 변경 및 명령 진행 단계는 대기 단계로 변경
    this.wrapCmdInfo.wrapCmdType = reqWCT.CANCEL;
    // 복원 명령 정의
    this.restoreCmdList = restoreCmdList;

    // 임계 명령 해제
    if (this.thresholdStorage) {
      this.removeThreshold();
    }

    // 이미 모든 명령을 완료한 상태라면 즉시 복원 명령 요청
    if (this.isCommandClear()) {
      return this.restoreCommand();
    }

    // 명령 단계를 CANCELING으로 교체
    // BU.CLI('명령 단계 CANCELING');
    this.updateCommandStep(cmdStep.CANCELING);

    // 아직 완료되지 못한 개체 취소 요청
    _.forEach(this.cmdElements, cmdElement => {
      // 취소 중이므로 살아있는 객체여부 false
      cmdElement.isLive = false;
      if (!cmdElement.isCommandClear()) {
        cmdElement.cancelCommandFromDLC();
      }
    });
  }

  /**
   * CANCELLING 과정
   */
  restoreCommand() {
    // 비동기 처리 과정 때문에 명령 단계 공지를 받지 못하는 경우가 있기 때문에 chaining 을 지연시킴
    if (this.restoreCmdList.length) {
      setImmediate(() => {
        // 자식 명령 객체 초기화
        this.cmdElements = [];
        // 요청해야 할 복원 세부 명령 등록
        this.setCommandElements(this.restoreCmdList);

        // 명령 단계: RESTORE 교체
        this.updateCommandStep(cmdStep.RESTORE);

        // 복원 명령 요청
        return this.executeCommandFromDLC();
      });
    } else {
      // 복원 명령이 없다면 최종적인 명령 단계: END 교체
      return this.updateCommandStep(cmdStep.END);
    }
  }

  /** Data Logger Controller에게 명령 실행 요청 */
  executeCommandFromDLC() {
    try {
      // 모든 명령이 완료된 경우라면 요청하지 않음
      if (this.isCommandClear()) {
        // 명령 스택자체가 없을 경우 동시에 notify가 발생하므로 약간의 지연을 갖추고 발송
        return setImmediate(() => this.handleCommandClear());
      }
      // 세부 명령 객체에게 장치 제어 명령 요청
      this.cmdElements.forEach(cmdElement => {
        cmdElement.executeCommandFromDLC();
      });
    } catch (error) {
      BU.error(error.message);
      // BU.error(error);
      // 데이터 전송에 문제가 있다면 해당 명령 삭제
      this.cancelCommand();
    }
  }

  /**
   * 세부 명령 실행 객체 목록 생성
   * @param {commandContainerInfo[]} commandContainerList
   */
  setCommandElements(commandContainerList) {
    this.cmdElements = [];

    commandContainerList.forEach(containerInfo => {
      const cmdElement = new CmdElement(containerInfo, this.coreFacade);
      cmdElement.setSuccessor(this);

      this.cmdElements.push(cmdElement);
    });
  }

  /**
   * 달성 목표 임계 추적 설정.
   * @description cmdStep.COMPLETE 되었을 경우 동작
   * @param {csCmdGoalContraintInfo} wrapCmdGoalInfo
   */
  setThreshold(wrapCmdGoalInfo = {}) {
    const { goalDataList, limitTimeSec } = wrapCmdGoalInfo;

    // 임계치가 존재하지 않을 경우 임계 설정 하지 않음
    if (!_.isNumber(limitTimeSec) && goalDataList.length === 0) {
      return false;
    }

    // 누적 임계가 실행되는 것 방지를 위한 초기화
    // this.removeThreshold();

    let isClearGoals = false;
    // 달성 목표가 존재하고 이미 해당 목표를 완료하였는지 체크
    if (_.isArray(goalDataList) && goalDataList.length) {
      // 달성 목표가 있을 경우 초기 값은 true
      isClearGoals = true;

      for (let index = 0; index < goalDataList.length; index += 1) {
        const goalInfo = goalDataList[index];

        // 달성 목표 도달 여부
        const isReachGoal = ThreCmdGoal.isReachGoal(this.coreFacade, goalInfo);
        // 달성 목표가 목표에 도달하였을 경우
        if (isReachGoal) {
          // 달성 목표 개체가 중요 개체일 경우
          if (goalInfo.isCompleteClear) {
            isClearGoals = true;
            break;
          }
        } else {
          // 달성하지 못하였다면 false
          isClearGoals = false;
        }
      }
    }

    // 달성 목표에 도달하였을 경우 임계 추적 객체를 생성하지 않고 종료
    if (isClearGoals) {
      return this.updateCommandStep(cmdStep.END);
    }

    // 새로운 임계치 저장소 생성
    const threCmdStorage = new ThreCmdStorage(this.coreFacade);
    // 매니저를 Successor로 등록
    threCmdStorage.setSuccessor(this);

    threCmdStorage.initThreCmd(wrapCmdGoalInfo);

    // 임계치 추적 저장소 정의
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
    this.thresholdStorage = undefined;
  }

  /** 명령 이벤트 발생 전파  */
  notifyObserver() {
    this.observers.forEach(observer => {
      if (_.get(observer, 'updateCommandStep')) {
        observer.updateCommandStep(this);
      }
    });
  }

  /**
   * 명령 이벤트가 발생되었을 경우
   * @param {string} updatedCmdStep 명령 저장소에 적용될 cmdStep
   */
  updateCommandStep(updatedCmdStep) {
    // 정해진 Event 값이 아니면 종료
    if (!Object.values(cmdStep).includes(updatedCmdStep)) return false;

    // 현재 이벤트와 다른 상태일 경우 전파
    if (this.cmdStep !== updatedCmdStep) {
      this.cmdStep = updatedCmdStep;
      return this.notifyObserver();
    }
  }

  /** @return {string} 명령 저장소 유일 UUID */
  get wrapCmdUUID() {
    return this.cmdStorageUuid;
  }

  /** @return {string} 명령 형식, MEASURE, SINGLE, SET, FLOW, SCENARIO */
  get wrapCmdFormat() {
    return this.wrapCmdInfo.wrapCmdFormat;
  }

  /** @return {string} 명령 타입, CONTROL, CANCEL */
  get wrapCmdType() {
    return this.wrapCmdInfo.wrapCmdType;
  }

  /** @return {string} 명령 ID */
  get wrapCmdId() {
    return this.wrapCmdInfo.wrapCmdId;
  }

  /** @return {string} 명령 이름 */
  get wrapCmdName() {
    return this.wrapCmdInfo.wrapCmdName;
  }

  /** @return {string} 명령 실행 우선 순위 */
  get rank() {
    return this.wrapCmdInfo.rank;
  }

  /** @return {csCmdGoalContraintInfo} 임계 정보 */
  get wrapCmdGoalInfo() {
    return this.wrapCmdInfo.wrapCmdGoalInfo;
  }

  /** @return {string} 출발지 장소 Id */
  get srcPlaceId() {
    return this.wrapCmdInfo.srcPlaceId;
  }

  /** @return {string} 목적지 장소 Id */
  get destPlaceId() {
    return this.wrapCmdInfo.destPlaceId;
  }

  /** @return {string} 명령 진행 단계: WAIT, PROCEED, COMPLETE, RUNNING, CANCELING, RESTORE, END */
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
    return _.filter(this.cmdElements, cmdElementSearch);
  }

  /** 모든 세부 명령 완료 여부 */
  isCommandClear() {
    // 모든 세부 명령 처리 여부
    return this.cmdElements.every(cmdElement => cmdElement.isCommandClear());
  }

  /**
   * @param {CmdElement} cmdElement
   *  세부 명령이 완료했을 경우
   */
  handleCommandClear(cmdElement) {
    // 모든 세부 명령이 완료되었을 경우
    if (this.isCommandClear()) {
      // 명령 취소를 완료하였을 경우 복원 명령 요청
      if (this.cmdStep === cmdStep.CANCELING) {
        return this.restoreCommand();
      }

      // 복원 명령을 완료할 경우 명령 단계: END
      if (this.cmdStep === cmdStep.RESTORE) {
        return this.updateCommandStep(cmdStep.END);
      }

      // 임계 명령이 존재할 경우 명령 단계: RUNNING
      if (!_.isEmpty(this.wrapCmdGoalInfo) && this.setThreshold(this.wrapCmdGoalInfo)) {
        return this.updateCommandStep(cmdStep.RUNNING);
      }

      // 달성 목표가 없고 명령 취소가 아니라면 명령 단계: COMPLETE
      return this.updateCommandStep(cmdStep.COMPLETE);
    }

    // 명령 단계: WAIT 일 경우 명령 단계: PROCEED
    if (
      this.cmdStep === cmdStep.WAIT &&
      _.get(cmdElement, 'cmdEleStep') === cmdStep.PROCEED
    ) {
      return this.updateCommandStep(cmdStep.PROCEED);
    }
  }

  /** @param {ThreCmdStorage} threCmdStorage */
  handleThresholdClear() {
    // 임계 명령 삭제
    this.removeThreshold();

    // 임계 명령이 종료되었으므로 명령 단계: END
    return this.updateCommandStep(cmdStep.END);
  }
}
module.exports = CmdStorage;
