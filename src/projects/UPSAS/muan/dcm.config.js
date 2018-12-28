// const Converter = require('device-protocol-converter-jh');
const Converter = require('../../../../../device-protocol-converter-jh');

const keyInfo = Converter.BaseModel.Inverter.BASE_KEY;

/**
 * @typedef {Object} tableParamFormat
 * @property {string} fromKey
 * @property {string} toKey
 */

module.exports = [
  {
    deviceCategory: 'inverter',
    troubleTableInfo: {
      tableName: 'pw_inverter_trouble_data',
      /** @type {Array.<tableParamFormat>} */
      addParamList: [
        {
          fromKey: 'inverter_seq',
          toKey: 'inverter_seq',
        },
      ],
      changeColumnKeyInfo: {
        isErrorKey: 'is_error',
        codeKey: 'code',
        msgKey: 'msg',
        occurDateKey: 'occur_date',
        fixDateKey: 'fix_date',
      },
      insertDateKey: 'writedate',
      indexInfo: {
        primaryKey: 'inverter_trouble_data_seq',
        foreignKey: 'inverter_seq',
      },
    },
    dataTableInfo: {
      tableName: 'pw_inverter_data',
      /** @type {tableParamFormat[]} */
      addParamList: [
        {
          fromKey: 'inverter_seq',
          toKey: 'inverter_seq',
        },
      ],
      insertDateKey: 'writedate',
      matchingList: [
        {
          fromKey: keyInfo.pvAmp,
          toKey: 'in_a',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.pvVol,
          toKey: 'in_v',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.pvKw,
          toKey: 'in_w',
          calculate: 1000,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridRAmp,
          toKey: 'out_a',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridRsVol,
          toKey: 'out_v',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.powerGridKw,
          toKey: 'out_w',
          calculate: 1000,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridLf,
          toKey: 'l_f',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.powerPf,
          toKey: 'p_f',
          calculate: `${keyInfo.powerGridKw} / ${keyInfo.pvKw} * 100`,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.powerCpKwh,
          toKey: 'c_wh',
          calculate: 1000,
          toFixed: 1,
        },
      ],
    },
  },
];
