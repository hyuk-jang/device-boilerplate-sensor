const { BU } = require('base-util-jh');

const DeviceManager = require('../../Util/DeviceManager');

const { BaseModel } = require('../../../../device-protocol-converter-jh');

/**
 * 현황판을 보여주기 위함
 */
class AbstPBS extends DeviceManager {
  /** @param {MainControl} controller */
  constructor(controller) {
    super();
    this.controller = controller;

    /** 기본 Encoding, Decondig 처리를 할 라이브러리 */
    this.defaultConverter = BaseModel.defaultModule;
    // 현황판 데이터를 요청할 스케줄러
    this.intervalScheduler = null;

    this.socketClient = controller.socketClient;

    this.eventHandler();
  }

  /** controller에서 eventEmitter 처리 */
  eventHandler() {
    try {
      /** controller 에서 인증 된 경우 발생할 handler */
      this.controller.on('nofityAuthentication', () => {
        BU.CLI('nofityAuthentication');
        this.runCronRequestPowerStatusBoard();
      });

      // 현황판 데이터 수신 완료
      this.controller.on('donePSB', powerStatusBoardData => {
        const bufData = this.defaultConverter.protocolConverter.makeMsg2Buffer(
          powerStatusBoardData,
        );
        // 수신 받은 현황판 데이터 전송

        this.write(bufData);
      });

      // 현황판 데이터 수신 실패
      this.controller.on('errorPSB', error => {
        BU.CLI(error);
        BU.errorLog('powerStatusBoard', error);
      });
    } catch (error) {
      BU.errorLog('powerStatusBoard', error);
    }
  }

  /**
   * @interface
   * 현황판 객체에서 Socket Server로 현황판 데이터를 요청하고 응답받은 데이터를 현황판으로 전송하는 메소드
   */
  async requestPowerStatusBoardInfo() {}

  /**
   * 현황판 데이터 요청 스케줄러
   */
  runCronRequestPowerStatusBoard() {
    try {
      if (this.intervalScheduler !== null) {
        // BU.CLI('Stop')
        clearInterval(this.intervalScheduler);
      }

      // 1분마다 요청
      this.intervalScheduler = setInterval(() => {
        this.requestPowerStatusBoardInfo();
      }, 1000 * 60);

      this.requestPowerStatusBoardInfo();

      return true;
    } catch (error) {
      throw error;
    }
  }
}
module.exports = AbstPBS;
