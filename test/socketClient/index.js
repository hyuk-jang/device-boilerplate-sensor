/**
 * 테스트를 하기 위한 절차
 * 1. Boilerplate 용 DB가 구성되고 .env에 그 경로가 명시되어야 한다.
 * 2. Main Socket Server가 구동되어야 한다.
 * 3. 위의 절차가 완료되엇다면 테스트 수행
 */

require('dotenv').config();
const _ = require('lodash');
const { BU } = require('base-util-jh');

const Promise = require('bluebird');

const {
  reqWrapCmdType,
  contractCmdStep,
  nodePickKey,
} = require('../../../default-intelligence').dcmConfigModel;
const { transmitToServerCommandType } = require('../../../default-intelligence').dcmWsModel;

const Main = require('../../src/Main');
const Control = require('../../src/Control');
const config = require('../../src/config');

const main = new Main();
const control = main.setControl(config);
control.bindingFeature();

const dumpNodeList = [
  {
    commandType: transmitToServerCommandType.NODE,
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
    commandType: transmitToServerCommandType.NODE,
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
    commandType: transmitToServerCommandType.NODE,
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
    commandType: transmitToServerCommandType.COMMAND,
    data: [
      {
        reqWrapCmdType: 'CONTROL',
        complexCmdStep: 'NEW',
        commandId: '증발지1 -> 저수지1',
        commandName: '증발지1 -> 저수지1',
        uuid: 'b3a18526-93ec-46fc-a44d-1c0b5cc900c6',
      },
    ],
  },
  {
    commandType: transmitToServerCommandType.COMMAND,
    data: [
      {
        reqWrapCmdType: 'CANCEL',
        complexCmdStep: 'NEW',
        commandId: '증발지1 -> 저수지1 취소',
        commandName: '증발지1 -> 저수지1 취소',
        uuid: '0eb58502-cfb7-46d6-b42d-cc3e381a8efa',
      },
    ],
  },
  {
    commandType: transmitToServerCommandType.COMMAND,
    data: [
      {
        reqWrapCmdType: 'MEASURE',
        complexCmdStep: 'NEW',
        commandId: 'RegularDevice',
        commandName: 'Regular',
        uuid: 'aaaaaaa-cfb7-46d6-b42d-alksjfalskfj',
      },
    ],
  },
];

// Case: 장치 정보가 변경되었을 때 Socket Server로의 데이터 전송
async function transmitNodeScenario() {
  // const {control.apiClient} = control;

  control.apiClient.transmitDataToServer(_.head(dumpNodeList));

  await Promise.delay(1000);
  // 같은 명령 1개 전송되면 서버측에는 이 데이터는 무시해야함
  control.apiClient.transmitDataToServer(_.head(dumpNodeList));
  await Promise.delay(1000);
  // 같은 명령 1개 전송되면 서버측에는 이 데이터는 무시해야함
  _.head(dumpNodeList).data[0].data = 'hi test';
  control.apiClient.transmitDataToServer(_.head(dumpNodeList));
  await Promise.delay(1000);

  dumpNodeList.forEach(transDataToClientInfo => {
    control.apiClient.transmitDataToServer(transDataToClientInfo);
  });
}

// Case: 명령이 생성, 시작, 종료, 실행 등의 과정
// TODO: 명령 정보를 보내고 이를  Socket Server가 제대로 감지하는지 테스트
async function transmitOrderScenario() {
  // Control
  const controlCmdNew = _.nth(dumpCommandList, 0);
  const controlCmdProceed = _.set(
    _.cloneDeep(controlCmdNew),
    'data[0].complexCmdStep',
    contractCmdStep.PROCEED,
  );

  const controlCmdComplete = _.set(
    _.cloneDeep(controlCmdNew),
    'data[0].complexCmdStep',
    contractCmdStep.COMPLETE,
  );

  // Cancel
  const cancelCmdNew = _.nth(dumpCommandList, 1);
  const cancelCmdProceed = _.set(
    _.cloneDeep(cancelCmdNew),
    'data[0].complexCmdStep',
    contractCmdStep.PROCEED,
  );
  const cancelCmdComplete = _.set(
    _.cloneDeep(cancelCmdNew),
    'data[0].complexCmdStep',
    contractCmdStep.COMPLETE,
  );

  // Measure
  const measureCmdNew = _.nth(dumpCommandList, 2);
  const measureCmdProceed = _.set(
    _.cloneDeep(measureCmdNew),
    'data[0].complexCmdStep',
    contractCmdStep.PROCEED,
  );
  const measureCmdComplete = _.set(
    _.cloneDeep(measureCmdNew),
    'data[0].complexCmdStep',
    contractCmdStep.COMPLETE,
  );

  // New 명령 등록
  control.apiClient.transmitDataToServer(controlCmdNew);
  await Promise.delay(1);
  // New 명령 동일 명령 재등록. <--- 무시되야 함
  control.apiClient.transmitDataToServer(controlCmdNew);
  await Promise.delay(1);

  // Proceed 명령등록. <--- 기존 CONTROL이 삭제되어야함
  control.apiClient.transmitDataToServer(controlCmdProceed);
  await Promise.delay(1);
  // Proceed 명령완료.
  control.apiClient.transmitDataToServer(controlCmdComplete);
  await Promise.delay(1);

  // 명령 취소
  control.apiClient.transmitDataToServer(cancelCmdNew);
  await Promise.delay(1);
  // 명령 삭제 진행중
  control.apiClient.transmitDataToServer(cancelCmdProceed);
  await Promise.delay(1);

  // 계측 명령 등재
  control.apiClient.transmitDataToServer(measureCmdNew);
  await Promise.delay(1);
}

// setTimeout(() => {
//   transmitNodeScenario();
// }, 1000);

setTimeout(() => {
  transmitOrderScenario();
}, 1000);

// TODO: Socket Server에서 현재 모든 정보 조회 명령을 요청 처리하는 메소드가 제대로 동작하는지 테스트
function callAllStatus() {}

// 초기화
// control
//   .init(
//     {
//       database: process.env.DB_UPSAS_DB,
//       host: process.env.DB_UPSAS_HOST,
//       password: process.env.DB_UPSAS_PW,
//       port: process.env.DB_UPSAS_PORT,
//       user: process.env.DB_UPSAS_USER,
//     },
//     'aaaaa',
//   )
//   .then(() => {
//     setTimeout(() => {
//       // 노드 정보 전송
//       transmitNodeScenario();
//     }, 2000);
//   });

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
