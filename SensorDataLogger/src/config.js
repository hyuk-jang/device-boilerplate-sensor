'use strict';

// require('./define.js');

// /** @type {{current: {hasDev: boolean, deviceInfo: deviceInfo}}} */

const {sensorDataLoggerConfig} = require('../../../default-intelligence').dcmConfigModel;

/** @type {sensorDataLoggerConfig} */
const config = {
  hasDev: false,
  deviceInfo: {
    
  },
  dataLoggerInfo: {
    /**
     * DB상에서 고유한 Logger ID
     * Data Logger Unique ID (Prefix + Main_Seq + Logger Code
     * @example
     * Main Seq: 3, Logger Prefix: DV, Code: 003 --> DV_3_003
     */
    sdl_real_id: 'R_GV_1_001',
    /**
     * Main당 일반적으로 부를 Logger ID
     * Data Logger ID (Prefix + Logger Code)
     * @example
     * Logger Prefix: DV, Code: 003 --> DV_003
     */
    sdl_id: 'R_GV_001',
    /** 장치 이름 */
    target_alias: 'Gate형 밸브',
    /** Data Logger Sequence */
    sensor_data_logger_seq: 0,
    connect_info: {
      /**
       * 장치 대분류
       * @example
       * socket, serial, zigbee
       */
      type: 'socket',
      /**
       * 장치 중분류
       * @type {string=} subType이 존재한다면 추가적으로 addConfigInfo가 필요함
       * @example
       * serial --> parser
       * zigbee --> xbee
       */
      subType: '',
      /**
       * @type {number=} Serial baud_rate
       * @defaultvalue 9600
       */
      baudRate: 9600,
      /**
       * @type {string|number=} 대분류가 serial, socket, zigbee일 경우에 사용
       * @example
       * serial, zigbee --> windows(COM1~), linux(...)
       * socket --> socket port
       */
      port: 9000,
      /**
       * @type {string} socket 일 경우 사용. localhost, IPv4
       */
      host: 'localhost',
      /**
       * @type {Object} subType이 존재할 경우 그에 해당하는 추가 접속 정보
       */
      addConfigInfo: {}
    },
    protocol_info: {
      /**
       * 파서 대분류
       * @example
       * Inverter, Connector, Weathercast, ESS, Saltern
       */
      mainCategory: 'UPSAS',
      /**
       * 파서 중분류
       * @example
       * Inverter --> das_1.3
       * Saltern --> xbee
       * Weathercast --> vantagepro2
       * ESS --> das_pv_led
       */
      subCategory: 'xbee',
      /**
       * 장치 ID, 보통 국번을 뜻함
       * @example
       * '001', Buffer('001')
       */
      deviceId: '0013A20040F7AB81',
      protocolOptionInfo: {
        hasTrackingData: true
      }
    },
    /** Data Logger 고유 코드(protocol_info 에 보통 국번으로 들어감) */
    serial_number: '001'
  },
  sensorList: [{
    /** sensor ID (Sequence) */
    sensor_seq: 29,
    /**
   * DB상에서 고유한 Sensor ID
   * Sensor Unique ID (Prefix + Main_Seq + Sensor Code
   * @example
   * Main Seq: 3, Sensor Def Prefix: WD, Code: 003 --> WD_3_003
   */
    sensor_real_id: 'WL_1_001',
    /**
   * Main 당 일반적으로 부를 Sensor ID
   * Sensor Unique ID (Prefix + Sensor Code)
   * @example
   * Sensor Def Prefix: WD, Code: 003 --> WD_3_003
   */  
    sensor_id: 'WL_001',
    /** Sensor Numbering 번호 (001, 002, ...) */
    target_code: '001',
    /**
   * Data Logger에서 수집한 데이터 군 중에서 해당 센서 데이터가 위치하는 인덱스
   * @default 0
   * @example
   * Data Logger Data --> {temp: [36.5, 35.1, 37.5], solar: [851, 768, 956]}
   * sc_target_id: temp 일 경우 --> 36.5 
   */
    data_logger_index: 0,
    /**
   * Sensor Data 이름.
   * @desc sc_target_id 와 data_logger_index를 이용하여 센서 데이터 결정
   * @example
   * temp, solar, lux, ws, reh, ...
   */
    sc_target_id: 'device',
    /**
   * 표기 단위
   * @example
   * ℃, %, m/s, ppm, ...
   */
    sc_data_unit: null
  },{
    /** sensor ID (Sequence) */
    sensor_seq: 20,
    /**
   * DB상에서 고유한 Sensor ID
   * Sensor Unique ID (Prefix + Main_Seq + Sensor Code
   * @example
   * Main Seq: 3, Sensor Def Prefix: WD, Code: 003 --> WD_3_003
   */
    sensor_real_id: 'SV_1_001',
    /**
   * Main 당 일반적으로 부를 Sensor ID
   * Sensor Unique ID (Prefix + Sensor Code)
   * @example
   * Sensor Def Prefix: WD, Code: 003 --> WD_3_003
   */  
    sensor_id: 'SV_001',
    /** Sensor Numbering 번호 (001, 002, ...) */
    target_code: '001',
    /**
   * Data Logger에서 수집한 데이터 군 중에서 해당 센서 데이터가 위치하는 인덱스
   * @default 0
   * @example
   * Data Logger Data --> {temp: [36.5, 35.1, 37.5], solar: [851, 768, 956]}
   * sc_target_id: temp 일 경우 --> 36.5 
   */
    data_logger_index: 0,
    /**
   * Sensor Data 이름.
   * @desc sc_target_id 와 data_logger_index를 이용하여 센서 데이터 결정
   * @example
   * temp, solar, lux, ws, reh, ...
   */
    sc_target_id: 'temp',
    /**
   * 표기 단위
   * @example
   * ℃, %, m/s, ppm, ...
   */
    sc_data_unit: 'cm'
  }]

};
module.exports = config;