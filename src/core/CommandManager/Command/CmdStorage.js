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

class CmdStorage extends CmdComponent {
  /**
   *
   */
  constructor() {
    super();

    this.cmdWrapUuid = uuidv4();

    this.cmdWrapInfo;

    this.successor;

    /** @type {CmdElement[]} */
    this.cmdElements = [];

    // 명령 초기화는 한번만 할 수 있음

    // 명령 이벤트를 받을 옵저버
    this.cmdEventObservers = [];

    _.once(this.executeCommand);
    _.once(this.cancelCommand);
  }

  /**
   * 최초 명령을 설정할 경우
   * @param {commandWrapInfo} cmdWrapInfo
   * @param {Observer[]} observers 명령의 실행 결과를 받을 옵저버
   */
  executeCommand(cmdWrapInfo, observers = []) {
    try {
      const { wrapCmdFormat, wrapCmdId, realContainerCmdList } = cmdWrapInfo;
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
      this.setCommandElements(realContainerCmdList);

      // 명령 대기 상태로 전환
      this.updateCommandEvent(cmdEvent.WAIT);

      // 명령 요청 실행
      this.executeCommandFromDLC();
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
      const { wrapCmdFormat, wrapCmdId, realContainerCmdList } = cmdWrapInfo;
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

      // 명령 취소 상태로 전환
      this.updateCommandEvent(cmdEvent.CANCELING);

      // 취소 명령 요청 실행
      this.executeCommandFromDLC();

      // Threshold 해제
      // CmdElement 옵저버 해제
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

  /**
   *
   * @param {string} cmdEleUuid
   */
  getCommandElement(cmdEleUuid) {
    return _.find(this.cmdElements, { cmdEleUuid });
  }

  /**
   * handleCommandClear 성공하였을 경우 알릴 Successor
   * @param {CommandComponent} cmdComponent
   */
  setSuccessor(cmdComponent) {
    this.successor = cmdComponent;
  }

  /**
   * 시나리오가 완료되었다고 판단
   * @param {string} CmdWrapId
   */
  updateCommandClear(CmdWrapId) {
    // 동기 명령 일 경우 현재 실행 중인 명령 Step만 점검
    if (this.isSync()) {
      return this.cmdElements[this.executeIndex].updateCommandClear(CmdWrapId);
    }
    // 비동기 명령일 경우 자식 요소에 모두 전파. 부합되는 명령이 존재할 경우 업데이트 처리하고 반환
    return _.some(this.cmdElements, child => child.updateCommandClear(CmdWrapId));
  }

  /** 현재 시나리오 명령 완료 여부 */
  isCommandClear() {
    // 동기 명령 일 경우 현재 실행 중인 명령 Step만 점검
    if (this.isSync()) {
      return this.cmdElements[this.executeIndex].isCommandClear();
    }
    // 자식 내 모든 시나리오가 처리되었는지 여부 확인
    return _.every(this.cmdElements, child => child.isCommandClear());
  }

  /** 단위 명령 요소가 완료되었을 경우 */
  handleCommandClear() {
    // 진행 중인 시나리오가 완료되었을 경우
    if (this.isCommandClear()) {
      // 동기 시나리오 일 경우 다음 시나리오 Step 요청
      if (this.isSync()) {
        return this.executeCommandFromDLC();
      }
      // 모든 시나리오 요소가 완료되었으므로 상위 시나리오 개체에게 처리 요청
      return this.successor.handleCommandClear();
    }
  }
}
module.exports = CmdStorage;
