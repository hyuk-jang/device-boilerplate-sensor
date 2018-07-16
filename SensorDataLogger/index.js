

const Control = require('./src/Control');

module.exports = Control;

// if __main process
if (require !== undefined && require.main === module) {
  console.log('__main__');
  require('dotenv').config();
  const _ = require('lodash');
  const config = require('./src/config');
  const {BU} = require('base-util-jh');

  const control = new Control(config);
  // control.getDataLoggerInfoByDB({
  //   database: process.env.DB_UPSAS_DB,
  //   host: process.env.DB_UPSAS_HOST,
  //   password: process.env.DB_UPSAS_PW,
  //   port: process.env.DB_UPSAS_PORT,
  //   user: process.env.DB_UPSAS_USER
  // }, {
  //   data_logger_seq: 1,
  //   main_seq: 1
  // });
  control.setDeviceInfo();
  control.init();
  control.model.hasAverageStorage = true;
  control.model.bindingAverageStorageForNode([_.nth(config.nodeList, 1)]);


  // BU.CLI(config)

  // cloneConfig.dataLoggerInfo.protocol_info.deviceId = '0013a20040f7ab81';
  // cloneConfig.dataLoggerInfo.dl_id = 'Direct';
  const {UPSAS} = require('../../../module/device-protocol-converter-jh').BaseModel;

  const baseModel = new UPSAS(config.deviceInfo.protocol_info);

  // setTimeout, setInterval
  setInterval(() => {
    control.orderOperation({nodeId: 'GV_001', hasTrue: undefined,  commandId: 'TEST'});
  }, 1000);

  // BU.CLI(baseModel.device.VALVE.COMMAND.CLOSE);

  /** TEST: 직접 명령을 내릴 경우 */
  // let node = config.nodeList[0];
  // let cmdList = control.converter.generationCommand({
  //   key: node.nc_target_id,
  //   controlValue: 0
  // });

  // BU.CLI(cmdList);
  // if(config.dataLoggerInfo.connect_info.type === 'socket'){
  //   cmdList.forEach(currentItem => {
  //     currentItem.data = JSON.stringify(currentItem.data);
  //   });
  // }
  // setTimeout(() => {
  //   let cmd_1 = control.generationManualCommand({cmdList});
  //   // BU.CLI(cmd_1.cmdList);
  //   control.executeCommand(cmd_1);
  // }, 3000);




  // control.setDeviceInfo();

  process.on('uncaughtException', function (err) {
    // BU.debugConsole();
    console.error(err.stack);
    console.log(err.message);
    console.log('Node NOT Exiting...');
  });
  
  
  process.on('unhandledRejection', function (err) {
    // BU.debugConsole();
    console.error(err.stack);
    console.log(err.message);
    console.log('Node NOT Exiting...');
  });
}