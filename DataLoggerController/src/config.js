/** @type {dataLoggerConfig} */
const config = {
  dataLoggerInfo: {
    connect_info: {
      type: 'serial',
      subType: 'parser',
      baudRate: 9600,
      addConfigInfo: {
        parser: 'delimiterParser',
        // parser: 'readLineParser',
        option: Buffer.from([4]),
      },
      port: 'COM29',
    },
    protocol_info: {
      // mainCategory: 'Inverter',
      // subCategory: 'hexPowerSingle',
      // deviceId: '06',
      mainCategory: 'Sensor',
      subCategory: 'CNT_dm_v1',
      deviceId: '002',
    },
  },
  nodeList: [],
};
module.exports = config;
