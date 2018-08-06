// require('./define.js');

// /** @type {{current: {hasDev: boolean, deviceInfo: deviceInfo}}} */

// require('../../../../default-intelligence').dcmConfigModel;

/** @type {dataLoggerConfig} */
const config = {
  hasDev: false,
  deviceInfo: {},
  dataLoggerInfo: {
    dl_real_id: 'R_EP_1_001',
    dl_id: 'R_EP_001',
    target_alias: 'Gate형 밸브',
    m_name: '6kW 급 TB',
    data_logger_seq: 1,
    main_seq: 1,
    data_logger_def_seq: 4,
    target_id: '0013A20040F7AB86',
    target_code: '001',
    connect_info: {
      type: 'socket',
      subType: '',
      baudRate: 9600,
      port: 9000,
    },
    protocol_info: {
      mainCategory: 'UPSAS',
      subCategory: 'xbee',
      deviceId: '0013A20040F7AB86',
    },
  },
  nodeList: [
    {
      node_seq: 20,
      node_real_id: 'MRT_1_005',
      node_id: 'MRT_005',
      node_name: '수문용 밸브 005',
      target_code: '005',
      data_logger_index: 1,
      dl_real_id: 'R_EP_1_001',
      dl_id: 'R_EP_001',
      nd_target_prefix: 'MRT',
      nd_target_id: 'moduleRearTemperature',
      nd_target_name: '모듈온도 005',
      nc_target_id: 'temp',
      nc_target_name: '밸브',
      nc_is_sensor: 0,
      nc_data_unit: null,
      nc_description: null,
      m_name: '6kW 급 TB',
      node_def_seq: 8,
      node_class_seq: 13,
      main_seq: 1,
      data_logger_seq: 1,
      data_logger_def_seq: 4,
    },
    {
      node_seq: 29,
      node_real_id: 'MRT_1_006',
      node_id: 'MRT_006',
      node_name: '수문용 밸브 006',
      target_code: '006',
      data_logger_index: 0,
      dl_real_id: 'R_EP_1_001',
      dl_id: 'R_EP_001',
      nd_target_prefix: 'MRT',
      nd_target_id: 'moduleRearTemperature',
      nd_target_name: '모듈온도 005',
      nc_target_id: 'temp',
      nc_target_name: '밸브',
      nc_data_unit: 'cm',
      nc_description: null,
      nc_is_sensor: 1,
      m_name: '6kW 급 TB',
      node_def_seq: 2,
      node_class_seq: 11,
      main_seq: 1,
      data_logger_seq: 1,
      data_logger_def_seq: 4,
    },
  ],
};
module.exports = config;
