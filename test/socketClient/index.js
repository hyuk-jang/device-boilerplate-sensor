require('dotenv').config();
const _ = require('lodash');
const {BU} = require('base-util-jh');

const {
  requestOrderCommandType,
  nodePickKey,
} = require('../../../default-intelligence').dcmConfigModel;

const Control = require('../../src/Control');
const config = require('../../src/config');

const control = new Control(config);

const dumpNodeList = [
  {
    commandType: 'node',
    data: [
      {
        node_seq: 1,
        node_real_id: 'WD_1_005',
        node_id: 'WD_005',
        node_name: '수문 005',
        target_code: '005',
        data_logger_index: 0,
        dl_real_id: 'R_G_1_005',
        dl_id: 'R_G_005',
        nd_target_prefix: 'WD',
        nd_target_id: 'waterDoor',
        nd_target_name: '수문',
        nc_target_id: 'waterDoor',
        nc_is_sensor: 0,
        nc_target_name: '수문',
        nc_data_unit: null,
        nc_description: null,
        m_name: '6kW 급 TB',
        node_def_seq: 1,
        node_class_seq: 12,
        main_seq: 1,
        data_logger_seq: 5,
        data_logger_def_seq: 1,
        getDataLogger: null,
        data: 'OPENING',
        writeDate: new Date(),
      },
    ],
  },
  {
    commandType: 'node',
    data: [
      {
        node_seq: 25,
        node_real_id: 'P_1_002',
        node_id: 'P_002',
        node_name: '펌프 002',
        target_code: '002',
        data_logger_index: 0,
        dl_real_id: 'R_P_1_002',
        dl_id: 'R_P_002',
        nd_target_prefix: 'P',
        nd_target_id: 'pump',
        nd_target_name: '펌프',
        nc_target_id: 'pump',
        nc_is_sensor: 0,
        nc_target_name: '펌프',
        nc_data_unit: null,
        nc_description: null,
        m_name: '6kW 급 TB',
        node_def_seq: 5,
        node_class_seq: 14,
        main_seq: 1,
        data_logger_seq: 24,
        data_logger_def_seq: 3,
        getDataLogger: null,
        data: 'OFF',
        writeDate: new Date(),
      },
    ],
  },
  {
    commandType: 'node',
    data: [
      {
        node_seq: 15,
        node_real_id: 'V_1_003',
        node_id: 'V_003',
        node_name: '밸브 003',
        target_code: '003',
        data_logger_index: 0,
        dl_real_id: 'R_V_1_003',
        dl_id: 'R_V_003',
        nd_target_prefix: 'V',
        nd_target_id: 'valve',
        nd_target_name: '밸브',
        nc_target_id: 'valve',
        nc_is_sensor: 0,
        nc_target_name: '밸브',
        nc_data_unit: null,
        nc_description: null,
        m_name: '6kW 급 TB',
        node_def_seq: 4,
        node_class_seq: 13,
        main_seq: 1,
        data_logger_seq: 19,
        data_logger_def_seq: 2,
        getDataLogger: null,
        data: 'CLOSE',
        writeDate: new Date(),
      },
      {
        node_seq: 35,
        node_real_id: 'MRT_1_003',
        node_id: 'MRT_003',
        node_name: '모듈 뒷면 온도 003',
        target_code: '003',
        data_logger_index: 0,
        dl_real_id: 'R_V_1_003',
        dl_id: 'R_V_003',
        nd_target_prefix: 'MRT',
        nd_target_id: 'moduleRearTemperature',
        nd_target_name: '모듈 뒷면 온도',
        nc_target_id: 'temp',
        nc_is_sensor: 1,
        nc_target_name: '온도',
        nc_data_unit: '℃',
        nc_description: '섭씨',
        m_name: '6kW 급 TB',
        node_def_seq: 7,
        node_class_seq: 1,
        main_seq: 1,
        data_logger_seq: 19,
        data_logger_def_seq: 2,
        getDataLogger: null,
        data: 21.2,
        writeDate: new Date(),
      },
    ],
  },
];

const dumpCommandList = [
  {
    commandType: 'command',
    data: {
      orderCommandType: 'CONTROL',
      orderStatus: 'NEW',
      commandId: '증발지1 -> 저수지1',
      commandName: '증발지1 -> 저수지1',
      uuid: 'b3a18526-93ec-46fc-a44d-1c0b5cc900c6',
    },
  },
  {
    commandType: 'command',
    data: {
      orderCommandType: 'CANCEL',
      orderStatus: 'NEW',
      commandId: '증발지1 -> 저수지1 취소',
      commandName: '증발지1 -> 저수지1 취소',
      uuid: '0eb58502-cfb7-46d6-b42d-cc3e381a8efa',
    },
  },
];

control
  .getDataLoggerListByDB(
    {
      database: process.env.DB_UPSAS_DB,
      host: process.env.DB_UPSAS_HOST,
      password: process.env.DB_UPSAS_PW,
      port: process.env.DB_UPSAS_PORT,
      user: process.env.DB_UPSAS_USER,
    },
    'aaaaa',
  )
  .then(() => {
    control.init();
    setTimeout(() => {
      // 명령 제어 요청
      control.executeAutomaticControl(testDumpCmd);
    }, 2000);
  });

process.on('uncaughtException', err => {
  // BU.debugConsole();
  console.error(err.stack);
  console.log(err.message);
  console.log('Node NOT Exiting...');
});

process.on('unhandledRejection', err => {
  // BU.debugConsole();
  console.error(err.stack);
  console.log(err.message);
  console.log('Node NOT Exiting...');
});
