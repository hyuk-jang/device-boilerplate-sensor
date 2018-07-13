

const Control = require('./src/Control');

module.exports = Control;

// if __main process
if (require !== undefined && require.main === module) {
  console.log('__main__');
  const _ = require('lodash');
  const config = require('./src/config');
  const {BU} = require('base-util-jh');

  const control = new Control(config);
  control.setDeviceInfo();
  control.init();

  // BU.CLI(config)

  // const cloneConfig = _.cloneDeep(config);
  // cloneConfig.dataLoggerInfo.protocol_info.deviceId = '0013a20040f7ab81';
  // cloneConfig.dataLoggerInfo.sdl_id = 'Direct';
  // const control_2 = new Control(cloneConfig);
  // control_2.init();
  const {BaseModel} = require('../../../module/device-protocol-converter-jh');

  const baseModel = new BaseModel.Saltern(config.deviceInfo.protocol_info);

  // BU.CLI(baseModel.device.VALVE.COMMAND.CLOSE);
  let cmdList = control.converter.generationCommand(baseModel.device.VALVE.COMMAND.STATUS);
  BU.CLI(cmdList);
  if(config.dataLoggerInfo.connect_info.type === 'socket'){
    cmdList.forEach(currentItem => {
      currentItem.data = JSON.stringify(currentItem.data);
    });
  }
  setTimeout(() => {
    let cmd_1 = control.generationManualCommand({cmdList});
    // BU.CLI(cmd_1.cmdList);
    control.executeCommand(cmd_1);
  }, 3000);




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