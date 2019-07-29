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
const ThreCmdGoal = require('./ThresholdCommand/ThreCmdGoal');

class CmdStorage extends CmdComponent {
  /**
   *
   */
  constructor() {
    super();

    this.cmdStorageUuid = uuidv4();

    this.wrapCmdInfo;

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
   * @param {commandWrapInfo} wrapCmdInfo
   */
  setCommand(wrapCmdInfo) {
    try {
      const { wrapCmdFormat, wrapCmdId, wrapCmdGoalInfo, containerCmdList } = wrapCmdInfo;

      // 명령 객체 정보 저장
      this.wrapCmdInfo = wrapCmdInfo;

      // 실제 제어할 목록 만큼 실행
      this.setCommandElements(containerCmdList);

      // 명령 임계 설정
      // this.setThreshold(wrapCmdGoalInfo);

      // 명령 대기 상태로 전환
      this.updateCommandStep(cmdStep.WAIT);

      // 명령 요청 실행
      // this.executeCommandFromDLC();
    } catch (error) {
      throw error;
    }
  }

  /**
   * 명령을 취소할 경우. DLC로 진행되지 않은 명령은 취소.
   * cmdElements정리 및 임계치 존재 시 제거
   * 복원 명령 존재 시 요청
   * @param {commandContainerInfo[]} restoreCmdList 복원 명령 목록
   */
  cancelCommand(restoreCmdList = []) {
    try {
      if (_.isEmpty(this.wrapCmdInfo)) {
        throw new Error('wrapCmdInfo does not exist.');
      }

      // 취소 상태로 변경 및 명령 진행 단계는 대기 단계로 변경
      this.wrapCmdInfo.wrapCmdType = reqWCT.CANCEL;

      // 명령 단계를 대기 상태로 교체
      // this.cmdStep = cmdStep.WAIT;

      // TODO: DLC로 진행되지 않은 명령은 취소.
      _(this.cmdElements)
        .filter(cmdEle => !cmdEle.isCommandClear())
        .forEach(cmdEle => cmdEle.cancelCommandFromDLC());

      // TODO: cmdElements정리 및 임계치 존재 시 제거
      if (this.thresholdStorage) {
        this.removeThreshold();
      }

      // 자식 명령 객체 초기화
      this.cmdElements = [];

      // 복원 명령 존재 시 요청
      if (restoreCmdList.length) {
        // BU.CLIN(restoreCmdList);
        // BU.CLI('복원 명령 진행');
        // 요청해야 할 복원 세부 명령 등록
        this.setCommandElements(restoreCmdList);
        // 명령 단계를 대기 단계로 조정
        this.updateCommandStep(cmdStep.WAIT);

        // BU.CLIN(this.cmdElements);
        // 취소 명령 요청 실행
        return this.executeCommandFromDLC();
      }

      // 복원 명령이 존재하지 않을 경우 완료 이벤트 발생
      return this.updateCommandStep(cmdStep.END);
    } catch (error) {
      throw error;
    }
  }

  /** Data Logger Controller에게 명령 실행 요청 */
  executeCommandFromDLC() {
    // BU.CLI('executeCommandFromDLC', this.cmdStep);
    // 명령 단계가 대기 중 일경우에만 요청 가능.
    if (this.cmdStep === cmdStep.WAIT) {
      // 무시하는 개체를 제외하고 검색
      _(this.cmdElements)
        .filter({ isIgnore: false })
        .forEach(cmdEle => cmdEle.executeCommandFromDLC());
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
    // BU.CLI('setThreshold', wrapCmdGoalInfo);

    const { goalDataList, limitTimeSec } = wrapCmdGoalInfo;

    // 임계치가 존재하지 않을 경우 임계 설정 하지 않음
    if (!_.isNumber(limitTimeSec) && goalDataList.length === 0) {
      return false;
    }

    // 누적 임계가 실행되는 것 방지를 위한 초기화
    this.removeThreshold();

    let isCompleteClear = false;
    // 달성 목표가 존재하고 이미 해당 목표를 완료하였는지 체크
    if (_.isArray(goalDataList) && goalDataList.length) {
      // 달성 목표가 있을 경우 초기 값은 true
      isCompleteClear = true;

      for (let index = 0; index < goalDataList.length; index += 1) {
        const goalInfo = goalDataList[index];

        // 달성 목표 도달 여부

        const isReachGoal = ThreCmdGoal.isReachGoal(goalInfo);
        // 달성 목표가 목표에 도달하였을 경우
        if (isReachGoal) {
          // 달성 목표 개체가 중요 개체일 경우
          if (goalInfo.isCompleteClear) {
            isCompleteClear = true;
            break;
          }
        } else {
          // 달성하지 못하였다면 false
          isCompleteClear = false;
        }
      }
    }

    // 달성 목표에 도달하였을 경우 임계 추적 객체를 생성하지 않고 종료
    if (isCompleteClear) {
      return this.updateCommandStep(cmdStep.END);
    }

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
    this.thresholdStorage = undefined;
  }

  /** 명령 이벤트 발생 전파  */
  notifyObserver() {
    // BU.CLI('notifyObserver', this.cmdStep);
    this.observers.forEach(observer => {
      if (_.get(observer, 'updateCommandStep')) {
        observer.updateCommandStep(this);
      }
    });
  }

  /**
   * 명령 이벤트가 발생되었을 경우
   * @param {string} updatedStorageStep 명령 저장소에 적용될 cmdStep
   */
  updateCommandStep(updatedStorageStep) {
    // BU.CLI(updatedStorageStep);
    // 이벤트 목록에 부합되는지 확인
    const isExistEvent = _.chain(cmdStep)
      .values()
      .includes(updatedStorageStep)
      .value();

    // 정해진 Event 값이 아니면 종료
    // BU.CLI(isExistEvent);
    if (!isExistEvent) return false;

    // 현재 이벤트와 다른 상태일 경우 전파
    if (this.cmdStep !== updatedStorageStep) {
      this.cmdStep = updatedStorageStep;
      return this.notifyObserver();
    }
  }

  /** @return {string} 명령 형식, SINGLE, SET, FLOW, SCENARIO */
  get wrapCmdUuid() {
    return this.cmdStorageUuid;
  }

  /** @return {string} 명령 형식, SINGLE, SET, FLOW, SCENARIO */
  get wrapCmdFormat() {
    return this.wrapCmdInfo.wrapCmdFormat;
  }

  /** @return {string} 명령 타입, CONTROL, CANCEL, RESTORE, MEASURE */
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
  get wrapCmdRank() {
    return this.wrapCmdInfo.rank;
  }

  /** @return {csCmdGoalContraintInfo} 임계 정보 */
  get wrapCmdGoalInfo() {
    return this.wrapCmdInfo.wrapCmdGoalInfo;
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
    // BU.CLIN(_.map(this.cmdElements, 'nodeId'));
    // BU.CLI(this.cmdElements.length, cmdElementSearch);
    return _.filter(this.cmdElements, cmdElementSearch);
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
      // BU.CLI('this.isCommandClear');
      // 취소 명령이라면 명령 종료
      if (this.wrapCmdType === reqWCT.CANCEL) {
        // BU.CLI('명령 종료!!!');
        return this.updateCommandStep(cmdStep.END);
      }
      // 임계 명령이 존재할 경우 자동으로 실행 중 상태로 변경
      // BU.CLIN(this.wrapCmdGoalInfo, 1);
      if (_.isObject(this.wrapCmdGoalInfo) && this.setThreshold(this.wrapCmdGoalInfo)) {
        // BU.CLI(cmdStep.RUNNING);
        // 명령 목표 달성 진행 중
        return this.updateCommandStep(cmdStep.RUNNING);
      }

      // 명령 요청 처리 완료 메시지를 전송
      return this.updateCommandStep(cmdStep.COMPLETE);
    }
    // 진행 중 상태
    return this.updateCommandStep(cmdStep.PROCEED);
  }

  /** @param {ThreCmdStorage} threCmdStorage */
  handleThresholdClear() {
    // BU.CLI('handleThresholdClear');
    // 임계 명령 삭제
    this.removeThreshold();

    // 명령 종료 업데이트
    return this.updateCommandStep(cmdStep.END);
  }
}
module.exports = CmdStorage;
