const {
  BaseModel: { UPSAS, Inverter },
} = require('../../../module').dpc;

const inverterKeyInfo = Inverter.BASE_KEY;
// const upsasKeyInfo = UPSAS.BASE_KEY;

/** @type {blockConfig[]} */
const blockConfigInfo = [
  {
    blockCategory: 'inverter',
    baseTableInfo: {
      tableName: 'pw_inverter',
      idKey: 'target_id',
      placeKey: 'place_seq',
      fromToKeyTableList: [
        {
          fromKey: 'inverter_seq',
          toKey: 'inverter_seq',
        },
      ],
    },
    applyTableInfo: {
      tableName: 'pw_inverter_data',
      insertDateColumn: 'writedate',
      matchingList: [
        {
          fromKey: inverterKeyInfo.pvAmp,
          toKey: 'pv_a',
        },
        {
          fromKey: inverterKeyInfo.pvVol,
          toKey: 'pv_v',
        },
        {
          fromKey: inverterKeyInfo.pvKw,
          toKey: 'pv_kw',
        },
        {
          fromKey: inverterKeyInfo.gridRsVol,
          toKey: 'grid_rs_v',
        },
        {
          fromKey: inverterKeyInfo.gridRAmp,
          toKey: 'grid_r_a',
        },
        {
          fromKey: inverterKeyInfo.gridLf,
          toKey: 'line_f',
        },
        {
          fromKey: inverterKeyInfo.powerGridKw,
          toKey: 'power_kw',
        },
        {
          fromKey: inverterKeyInfo.powerCpKwh,
          toKey: 'power_cp_kwh',
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
