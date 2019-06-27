const { BU } = require('base-util-jh');

const AbstPBS = require('./AbstPBS');
const { dcmWsModel } = require('../../core/CoreFacade');

/**
 * 수중태양광 용 현황판을 보여주기 위함
 * 본래 Boilerplate와는 거리가 있음.
 */
class PowerStatusBoard extends AbstPBS {
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

  /**
   * 현황판 객체에서 Socket Server로 현황판 데이터를 요청하고 응답받은 데이터를 현황판으로 전송하는 메소드
   */
  async requestPowerStatusBoardInfo() {
    try {
      this.apiClient.transmitDataToServer({
        commandType: dcmWsModel.transmitToServerCommandType.POWER_BOARD,
      });
    } catch (error) {
      BU.errorLog('powerStatusBoard', error);
    }
  }

  /**
   * Api Client에서 수신된 현황판 데이터 분석 및 현황판으로 해석 데이터 전송
   * @param {Error=} error
   * @param {Buffer} data 현황판 데이터
   */
  onDataFromApiClient(error, data) {
    if (error) {
      return BU.errorLog('powerStatusBoard', error);
    }

    // 수신 받은 현황판 데이터 Buffer로 변환
    const bufData = this.defaultConverter.protocolConverter.makeMsg2Buffer(data);
    // BU.CLI(bufData);
    const pbsData = Buffer.concat([Buffer.from([0x02]), bufData, Buffer.from([0x03])]);
    this.write(pbsData).catch(err => BU.errorLog('powerStatusBoard', err));
  }
}
module.exports = PowerStatusBoard;
