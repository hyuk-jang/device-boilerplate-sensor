const _ = require('lodash');
const moment = require('moment');

const { BM } = require('base-model-jh');
const { BU, CU } = require('base-util-jh');

const RAIN_CMD = {
  // 염수 대피
  rainEvacuation: 'rainEvacuation',
  // 염수 방출
  rainRelease: 'rainRelease',
  // 염수 대피 방출
  rainEvaRelease: 'rainEvaRelease',
  // 염수 복원
  rainRestore: 'rainRestore',
};

const RF = {
  NORMAL: 0,
  EVACUATION: 1,
  RELEASE: 2,
};

const JUDGMENT = {
  // 비가 옴
  TRUE: 1,
  // 비가 오지 않음
  FALSE: 0,
  // 판단 불가
  NULL: -1,
};

module.exports = class {
  /**
   *
   * @param {CoreFacade} coreFacade
   * @param {Object} siteInfo
   * @param {number} siteInfo.main_seq
   * @param {number} siteInfo.weather_location_seq
   */
  constructor(coreFacade, siteInfo) {
    this.coreFacade = coreFacade;
    const { main_seq: ms, weather_location_seq: wls } = siteInfo;

    this.biModule = coreFacade.model.biModule;

    this.mainSeq = ms;
    this.wls = wls;

    // Rain Flag 0: 무조치, 1: 염수 대피, 2: 바다로
    this.RF = RF.NORMAL;

    this.rainScheduler = null;
  }

  /** 우천 모드 체크 */
  init() {
    this.executeRainCommand();
  }

  /**
   * 데이터 로거의 현 상태를 조회하는 스케줄러
   */
  runRainCheckScheduler() {
    // BU.CLI('runDeviceInquiryScheduler');
    try {
      if (this.rainScheduler !== null) {
        // BU.CLI('Stop')
        clearInterval(this.rainScheduler);
      }
      // BU.CLI(this.config.inquiryIntervalSecond)
      // 1분마다 요청
      this.rainScheduler = setInterval(() => {
        this.executeRainCommand();
      }, 1000 * 60);

      return true;
    } catch (error) {
      throw error;
    }
  }

  /** 우천 상태에 따라 수행할 명령 판단 */
  async executeRainCommand() {
    const rainCmd = await this.checkRainStatus();

    // BU.CLI(rainCmd);

    const { rainEvaRelease, rainEvacuation, rainRelease, rainRestore } = RAIN_CMD;

    let prevRF = this.RF;

    // 우천 대피 방출, 우천 방출 일 경우 RF === RELEASE
    if ([rainEvaRelease, rainRelease].includes(rainCmd)) {
      prevRF = RF.RELEASE;
    }

    // 우천 대피 RF === EVACUATION
    if (rainEvacuation === rainCmd) {
      prevRF = RF.EVACUATION;
    }

    // 우천 복원 RF === NORMAL
    if (rainRestore === rainCmd) {
      prevRF = RF.NORMAL;
    }

    // 우천 추적 상태가 바뀌었을 경우 명령 수행
    if (prevRF !== this.RF) {
      // this.coreFacade.executeScenarioControl({
      //   wrapCmdId: rainCmd,
      // });
    }
  }

  /**
   * 기상계측장비와 기상청 동네예보 데이터를 분석하여 우천 추적 상태(RainFlag)에 따라 수행할 명령 반환
   */
  async checkRainStatus() {
    // 현재 우천 방출 상태가 아닐 경우 우천 판단 알고리즘 수행
    if (this.RF !== RF.RELEASE) {
      // 기상 계측 장비 판독 결과 비온다면
      const resultWeatherDevice = await this.checkRainWeatherDevice(10);
      // 장치에서 우천 판단
      if (resultWeatherDevice === JUDGMENT.TRUE) {
        // 기본 상태
        if (this.RF === RF.NORMAL) {
          return RAIN_CMD.rainEvaRelease;
        }
        // 대피 상태
        if (this.RF === RF.EVACUATION) {
          return RAIN_CMD.rainRelease;
        }
      }
    }
    // 현재 우천 추적 상태가 기본 상태일 경우에만 수행
    // 기상 계측 장비 판독 결과 비온다면
    const resultWeatherCast = await this.checkRainWeatherCast();

    // 동네예보에서 우천 판단
    if (resultWeatherCast === JUDGMENT.TRUE && this.RF === RF.NORMAL) {
      return RAIN_CMD.rainEvacuation;
    }
    // 동네예보에서는 비가 오지 않고 있다고 판단하고 현재 우천 추적 상태가 기본이 아닐 경우
    if (resultWeatherCast === JUDGMENT.FALSE && this.RF !== RF.NORMAL) {
      // 1시간 동안의 데이터를 기반으로 비가 오는지 체크
      const resultWeatherDevice = await this.checkRainWeatherDevice(60);

      // 비가 오지 않을 경우 복원 명령
      if (resultWeatherDevice.FALSE) {
        return RAIN_CMD.rainRestore;
      }
    }
  }

  /**
   * 기상 계측 장비의 데이터를 분석한 후 비가 내린다는 확신이 들경우 true 반환
   * @param {number=} rangeMin 특정시간
   * @return {JUDGMENT} 비가 온다면 true, 아닐 경우 false
   */
  async checkRainWeatherDevice(rangeMin = 10) {
    // 기상 계측 장비
    const weatherDeviceRows = await this.getWeatherDevice(rangeMin);

    // 70% 이상의 데이터를 보유하였을 경우에만 진행
    if (weatherDeviceRows.length < rangeMin * 0.7) return JUDGMENT.NULL;

    // 현재 강수량
    const rainRate = _.head(weatherDeviceRows).rain_h;
    // 현재 누적 강수량
    const currRainAmount = _.head(weatherDeviceRows).rain_d;
    // 과거 누적 강수량
    const prevRainAmount = _.last(weatherDeviceRows).rain_d;

    // 현재 강수량이 0 이상일 경우 우천
    if (rainRate > 0) {
      return JUDGMENT.TRUE;
    }
    // 과거 강수량보다 현재 강수량이 많을 경우 우천
    if (currRainAmount - prevRainAmount > 0) {
      return JUDGMENT.TRUE;
    }

    // 맑음
    return JUDGMENT.FALSE;
  }

  /**
   * 기상청 동네예보 데이터를 분석한 후 비가 내린다는 확신이 들경우 true 반환
   * @param {number=} rangeHour 특정시간
   * @return {JUDGMENT} 비가 온다면 true, 아닐 경우 false
   */
  async checkRainWeatherCast(rangeHour = 180) {
    // 비가 온다고 판단할 이전 시간(분)
    const isRainRangePrevMin = 30;
    // 기상청 동네 예보
    const weatherCastRows = await this.getWeatherCast(rangeHour);

    // 현재와 다음 시간대의 예보가 없다면 판단하지 않음
    if (weatherCastRows.length !== 2) return JUDGMENT.NULL;

    // 현재 PTY
    const currPTY = _.last(weatherCastRows).pty;
    // 다음 시간대의 PTY
    const nextPTY = _.head(weatherCastRows).pty;
    // 다음 시간대의 적용시간
    const nextApplyDate = _.head(weatherCastRows).applydate;

    // 현재 동네예보 강수상태 코드가 맑음 상태가 아닐 경우
    if (currPTY > 0) {
      return JUDGMENT.TRUE;
    }
    // 다음 동네예보 적용시간까지 남은 시간
    const nextApplyDateRemainMin = moment(nextApplyDate).diff(moment(), 'minute');

    // 과거 강수량보다 현재 강수량이 많을 경우 우천
    if (nextPTY > 0 && nextApplyDateRemainMin < isRainRangePrevMin) {
      return JUDGMENT.TRUE;
    }
    // 맑음
    return JUDGMENT.FALSE;
  }

  /**
   * 현재 시간을 기준으로 적용 중인 기상청 동네 예보를 현재와, 다음시간대 2개를 가져옴
   * @param {number=} rangeHour 동네예보 적용 구간 시간
   * @return {WC_KMA_DATA[]} 현재부터 내림차순
   */
  getWeatherCast(rangeHour = 3) {
    // 현재 적용 중인 시간대
    const currApplyDate = moment()
      .add(rangeHour, 'hour')
      .format('YYYY-MM-DD hh:mm:ss');

    const sql = `
      SELECT 
            * 
      FROM wc_kma_data
      WHERE weather_location_seq = ${this.wls}
       AND applydate <= '${currApplyDate}'
      ORDER BY kma_data_seq DESC
      LIMIT 2
    `;

    return this.biModule.db.single(sql);
  }

  /**
   * 현재 시간을 기준으로 과거 특정시간 동안의기록을 가져옴
   * @param {number=} rangeMin 특정시간
   * @return {WEATHER_DEVICE_DATA[]} 현재부터 내림차순
   *  */
  getWeatherDevice(rangeMin = 60) {
    // 현재 적용 중인 시간대
    const writedate = moment()
      .subtract(rangeMin, 'minute')
      .format('YYYY-MM-DD hh:mm:ss');

    const sql = `
      SELECT 
            * 
      FROM weather_device_data
      WHERE main_seq = ${this.mainSeq}
       AND writedate >= '${writedate}'
      ORDER BY weather_device_data_seq DESC
    `;

    return this.biModule.db.single(sql, null, true);
  }
};
