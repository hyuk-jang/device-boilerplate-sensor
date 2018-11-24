// require('./define.js');

// /** @type {{current: {hasDev: boolean, deviceInfo: deviceInfo}}} */

// require('../../../../default-intelligence').dcmConfigModel;

/** @type {dataLoggerConfig} */
const config = {
  deviceInfo: {},
  dataLoggerInfo: {
    data_logger_seq: 1,
    data_logger_def_seq: 1,
    main_seq: 1,
    dl_real_id: 'D_PV_1_001',
    dl_id: 'D_PV_001',
    dl_name: 'PV 001',
    m_name: '냉각형 태양광',
    dl_target_code: '001',
    dld_target_name: 'PV',
    dld_target_prefix: 'D_PV',
    serial_number: null,
    connect_info: {
      type: 'socket',
      // type: 'serial',
      subType: 'parser',
      addConfigInfo: { parser: 'readLineParser', option: '\r' },
      baudRate: 9600,
      port: 9000,
      // port: 'COM8',
      host: 'localhost',
    },
    protocol_info: { mainCategory: 'Sensor', subCategory: 'EanPV' },
  },
  nodeList: [
    {
      node_seq: 6,
      node_def_seq: 4,
      node_class_seq: 2,
      data_logger_seq: 1,
      main_seq: 1,
      node_id: 'V_PV_001',
      node_real_id: 'V_PV_1_001',
      node_name: 'PV 전압 001',
      dl_real_id: 'D_PV_1_001',
      dl_id: 'D_PV_001',
      dl_name: 'PV 001',
      data_unit: 'V',
      is_sensor: 1,
      data_logger_index: 0,
      n_target_code: '001',
      nd_target_id: 'pvVol',
      nd_target_name: 'PV 전압',
      nd_target_prefix: 'V_PV',
      nd_description: '200W 급',
      nc_target_id: 'vol',
      nc_target_name: '전압',
      nc_description: null,
    },
  ],
};
module.exports = config;
