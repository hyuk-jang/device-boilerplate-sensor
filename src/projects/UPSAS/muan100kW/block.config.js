const {
  BaseModel: { Inverter, UPSAS, Sensor },
} = require('../../../../../device-protocol-converter-jh');

// const Converter = require('device-protocol-converter-jh');
// const Converter = require('../../../../../device-protocol-converter-jh');

const inverterKeyInfo = Inverter.BASE_KEY;
const sensorKeyInfo = Sensor.BASE_KEY;
const upsasKeyInfo = UPSAS.BASE_KEY;

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
          fromKey: inverterKeyInfo.gridStVol,
          toKey: 'grid_st_v',
        },
        {
          fromKey: inverterKeyInfo.gridTrVol,
          toKey: 'grid_tr_v',
        },
        {
          fromKey: inverterKeyInfo.gridRAmp,
          toKey: 'grid_r_a',
        },
        {
          fromKey: inverterKeyInfo.gridSAmp,
          toKey: 'grid_s_a',
        },
        {
          fromKey: inverterKeyInfo.gridTAmp,
          toKey: 'grid_t_a',
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
  {
    blockCategory: 'connector',
    baseTableInfo: {
      tableName: 'pw_pv',
      idKey: 'target_id',
      placeKey: 'place_seq',
      fromToKeyTableList: [
        {
          fromKey: 'pv_seq',
          toKey: 'pv_seq',
        },
      ],
    },
    applyTableInfo: {
      tableName: 'pw_pv_data',
      insertDateColumn: 'writedate',
      matchingList: [
        {
          fromKey: sensorKeyInfo.pvAmp,
          toKey: 'amp',
        },
        {
          fromKey: sensorKeyInfo.pvVol,
          toKey: 'vol',
        },
      ],
    },
    troubleTableInfo: {
      tableName: 'pw_pv_trouble_data',
      insertDateColumn: 'writedate',
      fromToKeyTableList: [
        {
          fromKey: 'pv_seq',
          toKey: 'pv_seq',
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
        primaryKey: 'pv_trouble_data_seq',
        foreignKey: 'pv_seq',
      },
    },
  },
  {
    blockCategory: 'saltern',
    baseTableInfo: {
      tableName: 'v_dv_place',
      idKey: 'place_real_id',
      placeKey: 'place_seq',
      placeClassKeyList: ['salternBlock', 'brineWarehouse', 'reservoir', 'sea'],
      fromToKeyTableList: [
        {
          fromKey: 'place_seq',
          toKey: 'place_seq',
        },
      ],
    },
    applyTableInfo: {
      tableName: 'saltern_sensor_data',
      insertDateColumn: 'writedate',
      matchingList: [
        {
          fromKey: upsasKeyInfo.waterLevel,
          toKey: 'water_level',
        },
        {
          fromKey: upsasKeyInfo.salinity,
          toKey: 'salinity',
        },
        {
          fromKey: upsasKeyInfo.moduleRearTemperature,
          toKey: 'module_rear_temp',
        },
        {
          fromKey: upsasKeyInfo.brineTemperature,
          toKey: 'brine_temp',
        },
      ],
    },
  },
];

module.exports = blockConfigInfo;
