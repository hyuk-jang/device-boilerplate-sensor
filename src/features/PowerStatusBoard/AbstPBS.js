const { BU } = require('base-util-jh');

const DeviceManager = require('../../utils/DeviceManager');

const { BaseModel } = require('../../../../device-protocol-converter-jh');

const { dcmWsModel } = require('../../../../default-intelligence');

/**
 * 현황판을 보여주기 위함
 */
class AbstPBS extends DeviceManager {
  /** @param {MainControl} controller */
  constructor(controller) {
    super();
    this.controller = controller;
    // Server와 통신하는 Socket Client 객체
    this.apiClient = controller.apiClient;

    /** 기본 Encoding, Decondig 처리를 할 라이브러리 */
    this.defaultConverter = BaseModel.defaultModule;
    // 현황판 데이터를 요청할 스케줄러
    this.intervalScheduler = null;
  }

  /**
   * Api Client에서 수신된 현황판 데이터
   * @param {Error=} error
   * @param {*} data
   */
  onDataFromApiClient(error, data) {}

  /**
   * 현황판 데이터 요청 스케줄러
   */
  runCronRequestPowerStatusBoard() {}

  /**
   * 현황판 객체에서 Socket Server로 현황판 데이터를 요청하고 응답받은 데이터를 현황판으로 전송하는 메소드
   */
  requestPowerStatusBoardInfo() {}
}
module.exports = AbstPBS;
