require('../../../src/features/BlockManager/block.jsdoc');

const Converter = require('../../../../device-protocol-converter-jh');

const keyInfo = Converter.BaseModel.Inverter.BASE_KEY;

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
        },
        {
          fromKey: keyInfo.pvVol,
          toKey: 'in_v',
        },
        {
          fromKey: keyInfo.pvKw,
          toKey: 'in_w',
          calculate: 1000,
        },
        {
          fromKey: keyInfo.gridRAmp,
          toKey: 'out_a',
        },
        {
          fromKey: keyInfo.gridRsVol,
          toKey: 'out_v',
        },
        {
          fromKey: keyInfo.powerGridKw,
          toKey: 'out_w',
          calculate: 1000,
        },
        {
          fromKey: keyInfo.powerPf,
          toKey: 'p_f',
        },
        {
          fromKey: keyInfo.powerCpKwh,
          toKey: 'c_wh',
          calculate: 1000,
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
