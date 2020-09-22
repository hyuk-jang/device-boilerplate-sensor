const _ = require('lodash');
const eventToPromise = require('event-to-promise');
const EventEmitter = require('events');

const { BU } = require('base-util-jh');

const { DccFacade } = require('../module');

class DeviceManager extends EventEmitter {
  /**
   * 컨트롤러 ID를 가져올 경우
   * @return {string} Device Controller를 대표하는 ID
   */
  get id() {
    return _.get(this, 'deviceInfo.target_id');
  }

  /**
   * 장치와의 접속 여부 확인
   */
  get isConnect() {
    return !_.isEmpty(_.get(this, 'deviceController.client', {}));
  }

  /**
   * @param {deviceInfo} deviceInfo
   */
  async connect(deviceInfo = {}) {
    // BU.CLI('connect', deviceInfo);
    this.deviceInfo = deviceInfo;
    // 모델 선언
    try {
      const dccFacade = new DccFacade();
      this.definedControlEvent = dccFacade.definedControlEvent;
      const { CONNECT, DISCONNECT } = this.definedControlEvent;

      this.deviceController = dccFacade.setDeviceController({
        ...deviceInfo,
        controlInfo: {
          hasReconnect: true,
        },
      });

      this.deviceController.attach(this);

      // 이미 접속 중인 객체가 있다면
      if (!_.isEmpty(this.deviceController.client)) {
        // API Client 인증 여부 처리
        _.has(this, 'hasCertification') && _.set(this, 'hasCertification', true);
        return this.deviceController;
      }

      await eventToPromise.multi(this, [CONNECT], [DISCONNECT]);

      return this.deviceController;
    } catch (error) {
      // 초기화에 실패할 경우에는 에러 처리
      if (error instanceof ReferenceError) {
        throw error;
      }
    }
  }

  /**
   * Device Controller에서 새로운 이벤트가 발생되었을 경우 알림
   * @param {string} eventName 'dcConnect' 연결, 'dcClose' 닫힘, 'dcError' 에러
   */
  onEvent(eventName) {
    const { CONNECT, DISCONNECT } = this.definedControlEvent;

    switch (eventName) {
      case CONNECT:
        this.emit(CONNECT);
        break;
      case DISCONNECT:
        this.emit(DISCONNECT);
        break;
      default:
        break;
    }
  }

  /**
   * 장치로부터 데이터 수신
   * @interface
   * @param {buffer} bufData 현재 장비에서 실행되고 있는 명령 객체
   */
  onData(bufData) {
    BU.CLI(bufData.toString());
  }

  /**
   * 메시지 전송
   * @param {*} msg 전송 데이터
   * @return {Promise.<boolean>} Promise 반환 객체
   */
  async write(msg) {
    await this.deviceController.write(msg);
    return true;
  }
}
module.exports = DeviceManager;
