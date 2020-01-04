const {
  BaseModel: { Inverter },
} = require('../../../module').dpc;

const keyInfo = Inverter.BASE_KEY;

/** @type {blockConfig[]} */
const blockConfigInfo = [
  {
    blockCategory: 'inverter',
    baseTableInfo: {
      tableName: 'inverter',
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
      tableName: 'inverter_data',
      insertDateColumn: 'writedate',
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
        // {
        //   fromKey: keyInfo.gridLf,
        //   toKey: 'l_f',
        //   calculate: 1,
        //   toFixed: 1,
        // },
        {
          fromKey: keyInfo.powerPf,
          toKey: 'p_f',
          calculate: 1,
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
    troubleTableInfo: {
      tableName: 'inverter_trouble_data',
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
