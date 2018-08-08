// require('./define.js');

// /** @type {{current: {hasDev: boolean, deviceInfo: deviceInfo}}} */

require('../../../default-intelligence').dcmConfigModel;

/** @type {dataLoggerConfig} */
const config = {
  hasDev: false,
  deviceInfo: {},
  dataLoggerInfo: {
    dl_real_id: 'R_GV_1_001',
    dl_id: 'R_GV_001',
    dld_target_name: 'Gate형 밸브',
    m_name: '6kW 급 TB',
    data_logger_seq: 1,
    main_seq: 1,
    data_logger_def_seq: 4,
    serial_number: '0013A20040F7AB81',
    dl_target_code: '001',
    connect_info: {
      type: 'socket',
      subType: '',
      baudRate: 9600,
      port: 9000,
    },
    protocol_info: {
      mainCategory: 'UPSAS',
      subCategory: 'xbee',
      deviceId: '0013A20040F7AB81',
    },
  },
  nodeList: [
    {
      node_seq: 20,
      node_real_id: 'GV_1_001',
      node_id: 'GV_001',
      node_name: '수문용 밸브 001',
      n_target_code: '001',
      data_logger_index: 0,
      dl_real_id: 'R_GV_1_001',
      dl_id: 'R_GV_001',
      nd_target_prefix: 'GV',
      nd_target_id: 'gateValve',
      nd_target_name: '수문용 밸브',
      nc_target_id: 'valve',
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
      node_real_id: 'WL_1_001',
      node_id: 'WL_001',
      node_name: '수위 001',
      n_target_code: '001',
      data_logger_index: 0,
      dl_real_id: 'R_GV_1_001',
      dl_id: 'R_GV_001',
      nd_target_prefix: 'WL',
      nd_target_id: 'waterLevel',
      nd_target_name: null,
      nc_target_id: 'waterLevel',
      nc_target_name: '수위',
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
