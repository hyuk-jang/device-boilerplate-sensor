// const Converter = require('device-protocol-converter-jh');
const Converter = require('../../../../../device-protocol-converter-jh');

const keyInfo = Converter.BaseModel.Inverter.BASE_KEY;

/** @type {blockConfig[]} */
const blockConfigInfo = [
  {
    blockCategory: 'inverter',
    baseTableInfo: {
      tableName: 'inverter',
      fromToKeyTableList: [
        {
          fromKey: 'inverter_seq',
          toKey: 'inverter_seq',
        },
      ],
    },
    applyTableInfo: {
      tableName: 'inverter_data',
      insertDateColumn: 'writedate',
      matchingList: [
        {
          fromKey: keyInfo.pvAmp,
          toKey: 'pv_a',
          toFixed: 1,
        },
        {
          fromKey: keyInfo.pvVol,
          toKey: 'pv_v',
          toFixed: 1,
        },
        {
          fromKey: keyInfo.pvKw,
          toKey: 'pv_kw',
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridRsVol,
          toKey: 'grid_rs_v',
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridStVol,
          toKey: 'grid_st_v',
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridTrVol,
          toKey: 'grid_tr_v',
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridRAmp,
          toKey: 'grid_r_a',
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridSAmp,
          toKey: 'grid_s_a',
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridTAmp,
          toKey: 'grid_t_a',
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridLf,
          toKey: 'line_f',
          toFixed: 1,
        },
        {
          fromKey: keyInfo.powerPf,
          toKey: 'power_f',
          toFixed: 1,
        },
        {
          fromKey: keyInfo.powerGridKw,
          toKey: 'power_kw',
          toFixed: 1,
        },
        {
          fromKey: keyInfo.powerCpKwh,
          toKey: 'power_total_kwh',
          toFixed: 1,
        },
      ],
    },
    troubleTableInfo: {
      tableName: 'pw_inverter_trouble_data',
      insertDateColumn: 'writedate',
      fromToKeyTableList: [
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
      indexInfo: {
        primaryKey: 'inverter_trouble_data_seq',
        foreignKey: 'inverter_seq',
      },
    },
  },
];

module.exports = blockConfigInfo;
