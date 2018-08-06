const Promise = require('bluebird');
const _ = require('lodash');

const {BU, CU} = require('base-util-jh');

const {definedControlEvent} = require('../../../default-intelligence').dccFlagModel;

class AbstController {
  constructor() {
    /** @type {Array.<AbstManager>}  */
    this.observers = [];
    this.client = {};

    /** 장치와의 연결 여부  */
    this.hasConnect;
    this.connectTimer;
    // 장치 재접속 인터벌
    this.connectIntervalTime = 1000 * 5;

    // TEST
    this.requestConnectCount = 0;
  }

  setInit() {
    this.connectTimer = new CU.Timer(() => this.doConnect(), 10);
  }

  // 장치와의 접속을 시도
  async doConnect() {
    // BU.CLI('doConnect');
    const timer = this.connectTimer;
    // 타이머가 작동중이고 남아있는 시간이 있다면 doConnect가 곧 호출되므로 실행하지 않음
    if (timer.getStateRunning() && timer.getTimeLeft() > 0) {
      // BU.CLI('이미 타이머가 작동 중입니다.');
      return false;
    }
    timer.pause();
    try {
      BU.CLI('doConnect()', this.configInfo);
      // 장치 접속 관리 객체가 없다면 접속 수행
      if (_.isEmpty(this.client)) {
        await this.connect();

        // 장치 연결 요청이 완료됐으나 연결 객체가 없다면 예외 발생
        if (_.isEmpty(this.client)) {
          throw new Error('Try Connect To Device Error');
        }
      }
      // 장치와 접속이 되었다고 알림
      return this.notifyConnect();
    } catch (error) {
      // 장치 접속 요청 실패 이벤트 발생
      // this.notifyError(error);
      // 새로운 타이머 할당
      this.connectTimer = new CU.Timer(() => {
        _.isEmpty(this.client) ? this.doConnect() : this.notifyConnect();
        // 장치 접속 시도 후 타이머 제거
      }, this.connectIntervalTime);
    }
  }

  /** @return {Promise} 접속 성공시 Resolve, 실패시 Reject  */
  async connect() {
    this.requestConnectCount += 1;
    BU.CLI('?', this.requestConnectCount);
  }

  // TODO 장치와의 연결 접속 해제 필요시 작성
  disconnect() {}

  /**
   * @param {*} msgInfo 각 장치에 맞는 명령 정보
   * @return {Promise} 전송 성공시 Resolve, 실패시 Reject
   */
  async write() {}

  attach(observer) {
    // BU.log('Observer attached');
    this.observers.push(observer);
  }

  /** @param {AbstManager} observer */
  dettach(observer) {
    // BU.log('dettach');
    this.observers.forEach((currentItem, index) => {
      if (currentItem === observer) {
        this.observers.splice(index, 1);
      }
    });
  }

  notifyEvent(eventName) {
    // BU.CLI('notifyEvent', eventName);
    this.observers.forEach(observer => {
      observer.onEvent(eventName);
    });
  }

  /** 장치와의 연결이 수립되었을 경우 */
  notifyConnect() {
    // BU.CLI('notifyConnect');
    if (!this.hasConnect && !_.isEmpty(this.client)) {
      this.hasConnect = true;
      this.notifyEvent(definedControlEvent.CONNECT);

      // 타이머가 살아있다면 정지
      this.connectTimer.getStateRunning() && this.connectTimer.pause();
    }
  }

  /** 장치와의 연결이 해제되었을 경우 */
  notifyDisconnect() {
    // BU.CLI('notifyClose');
    // 장치와의 연결이 계속해제된 상태였다면 이벤트를 보내지 않음
    if (this.hasConnect !== false && _.isEmpty(this.client)) {
      this.hasConnect = false;
      this.notifyEvent(definedControlEvent.DISCONNECT);
      // 이벤트 발송 및 약간의 장치와의 접속 딜레이를 1초 줌
      // 재접속 옵션이 있을 경우에만 자동 재접속 수행
      Promise.delay(1000).then(() => {
        if (_.isEmpty(this.client) && !this.connectTimer.getStateRunning()) {
          this.doConnect();
        }
      });
    }
  }

  /**
   * 장치에서 에러가 발생하였다면
   * @param {Error} error
   */
  notifyError(error) {
    BU.CLI('notifyError', error);
    // 장치에서 이미 에러 내역을 발송한 상태라면 이벤트를 보내지 않음
    // this.notifyDisconnect();
  }

  /**
   * @param {*} data 각 controller에서 수신된 데이터
   */
  notifyData(data) {
    // BU.CLI('notifyData', data, data.length);
    this.observers.forEach(observer => {
      observer.onData(data);
    });
  }
}

module.exports = AbstController;
