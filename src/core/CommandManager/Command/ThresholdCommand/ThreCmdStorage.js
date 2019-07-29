const _ = require('lodash');

const { BU } = require('base-util-jh');

const CmdComponent = require('../CmdComponent');
const ThreCmdComponent = require('./ThreCmdComponent');
const ThreCmdGoal = require('./ThreCmdGoal');

const CoreFacade = require('../../../CoreFacade');

/**
 * 명령 달성 목표가 생성될 때 마다 객체를 생성.
 * 임계치 관리 저장소. Storage > Goal 순으로 Tree 구조를 가짐
 * 데이터가 갱신될 때 마다 해당 달성 목표가 처리 되었는지 확인.
 * 달성 목표를 완료하였거나 Timer의 동작이 진행되면 Successor에게 전파
 */
class ThreCmdStorage extends CmdComponent {
  /**
   *
   */
  constructor() {
    super();

    /** @type {ThreCmdGoal[]} */
    this.threCmdGoals = [];

    this.threCmdLimitTimer;
    this.cmdStorage;
  }

  /**
   *
   * @param {csCmdGoalContraintInfo} wrapCmdGoalInfo
   */
  initThreCmd(wrapCmdGoalInfo = {}) {
    const { goalDataList = [], limitTimeSec } = wrapCmdGoalInfo;

    // 임계치가 존재하지 않을 경우 임계 설정 하지 않음
    if (!_.isNumber(limitTimeSec) && goalDataList.length === 0) {
      return false;
    }

    // 설정 타이머가 존재한다면 제한 시간 타이머 동작
    if (_.isNumber(limitTimeSec)) {
      // BU.CLI('임계 타이머 작동');
      this.startLimiter(limitTimeSec);
    }

    const coreFacade = new CoreFacade();
    // 새로운 임계치 저장소 생성

    // 세부 달성 목록 목표만큼 객체 생성 후 옵저버 등록
    goalDataList.forEach(goalInfo => {
      const threCmdGoal = new ThreCmdGoal(goalInfo);
      // 세부 달성 목표 추가
      this.addThreCmdGoal(threCmdGoal);
      // 저장소를 Successor로 등록
      threCmdGoal.setSuccessor(this);
      // 노드 갱신 매니저에게 임계치 목표 객체를 옵저버로 등록
      coreFacade.attachNodeObserver(goalInfo.nodeId, threCmdGoal, true);
    });
  }

  /**
   * Threshold Command Storage에 걸려있는 임계치 타이머 삭제 및 Observer를 해제 후 삭제 처리
   */
  resetThreshold() {
    // 해당 임계치 없다면 false 반환
    const coreFacade = new CoreFacade();

    this.threCmdLimitTimer && clearTimeout(this.threCmdLimitTimer);

    // Update Node 정보를 받는 옵저버 해제
    this.threCmdGoalList.forEach(threCmdGoal => {
      coreFacade.dettachNodeObserver(threCmdGoal.nodeId, threCmdGoal);
    });
  }

  /**
   * notifyClear을 성공하였을 경우 알릴 Successor
   * @param {CmdComponent} cmdStorage Threshold Command Manager
   */
  setSuccessor(cmdStorage) {
    this.cmdStorage = cmdStorage;
  }

  /**
   * 제한 시간이 존재한다면 SetTimer 등록 및 세부 달성 목표 개체 정의
   * @param {number} limitTimeSec
   */
  startLimiter(limitTimeSec) {
    this.threCmdLimitTimer = setTimeout(() => {
      // 제한 시간 초과로 달성 목표를 이루었다고 판단
      // BU.CLIN(this.cmdStorage);
      this.cmdStorage.handleThresholdClear();
    }, limitTimeSec * 1000);
  }

  /** @param {ThreCmdGoal} threCmdGoal */
  addThreCmdGoal(threCmdGoal) {
    // 이미 존재한다면 false 반환
    if (_.findIndex(this.threCmdGoals, threCmdGoal) !== -1) return false;
    // 삽입 후 true 반환
    return this.threCmdGoals.push(threCmdGoal) && true;
  }

  /** @param {ThreCmdGoal} threCmdGoal */
  removeThreCmdGoal(threCmdGoal) {
    // 해당 인자가 존재할 경우 삭제 후 true 반환
    if (_.findIndex(this.threCmdGoals, threCmdGoal) === -1) {
      _.pull(this.threCmdGoals, threCmdGoal);
      return true;
    }
    return false;
  }

  /**
   * 임계치 저장소를 조회하고자 할 경우
   * @param {string} nodeId Node ID
   * @return {ThreCmdGoal}
   */
  getThreCmdGoal(nodeId) {
    return _.find(this.threCmdGoals, { nodeId });
  }

  /**
   * 저장소에 연결된 임계치 목표 객체 목록 반환
   * @return {ThreCmdGoal[]}
   */
  get threCmdGoalList() {
    return this.threCmdGoals;
  }

  /**
   * @return {boolean} 임계 명령 완료 여부
   */
  isThreCmdClear() {
    // BU.CLI(_.map(this.threCmdGoals, goal => _.pick(goal, ['nodeId', 'isClear'])));
    // 중요 달성 목표를 가진 개체가 존재하는지 체크
    const isCompleteClear = !!_.find(this.threCmdGoals, {
      isClear: true,
      isCompleteClear: true,
    });
    // 중요 달성 목표를 달성 하였다면
    if (isCompleteClear) return true;
    // 아닐 경우 모든 달성 목표를 클리어해야 true

    return _.every(this.threCmdGoals, 'isClear');
  }

  /**
   * 세부 목표를 완료했다고 알려 올 세부 객체
   * @param {ThreCmdGoal} threCmdGoal
   */
  handleThresholdClear(threCmdGoal) {
    // BU.CLI('handleThresholdClear');
    // 요청 처리된 임계치가 isCompleteClear 거나
    // 모든 조건이 충족되었다면 Successor에게 임계치 명령 달성 처리 의뢰
    if (threCmdGoal.isCompleteClear || this.isThreCmdClear()) {
      this.threCmdLimitTimer && clearTimeout(this.threCmdLimitTimer);
      this.cmdStorage.handleThresholdClear();
    }
  }
}
module.exports = ThreCmdStorage;
