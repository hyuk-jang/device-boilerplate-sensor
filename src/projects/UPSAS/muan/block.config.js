const {
  BaseModel: { Inverter, UPSAS, Sensor },
} = require('../../../module').dpc;

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
  {
    blockCategory: 'connector',
    baseTableInfo: {
      tableName: 'pw_connector',
      idKey: 'target_id',
      placeKey: 'place_seq',
      fromToKeyTableList: [
        {
          fromKey: 'connector_seq',
          toKey: 'connector_seq',
        },
      ],
    },
    applyTableInfo: {
      tableName: 'pw_connector_data',
      insertDateColumn: 'writedate',
      matchingList: [
        {
          fromKey: sensorKeyInfo.ampCh1,
          toKey: 'a_ch_1',
        },
        {
          fromKey: sensorKeyInfo.volCh1,
          toKey: 'v_ch_1',
        },
        {
          fromKey: sensorKeyInfo.ampCh2,
          toKey: 'a_ch_2',
        },
        {
          fromKey: sensorKeyInfo.volCh2,
          toKey: 'v_ch_2',
        },
        {
          fromKey: sensorKeyInfo.ampCh3,
          toKey: 'a_ch_3',
        },
        {
          fromKey: sensorKeyInfo.volCh3,
          toKey: 'v_ch_3',
        },
        {
          fromKey: sensorKeyInfo.ampCh4,
          toKey: 'a_ch_4',
        },
        {
          fromKey: sensorKeyInfo.volCh4,
          toKey: 'v_ch_4',
        },
        {
          fromKey: sensorKeyInfo.ampCh5,
          toKey: 'a_ch_5',
        },
        {
          fromKey: sensorKeyInfo.volCh5,
          toKey: 'v_ch_5',
        },
        {
          fromKey: sensorKeyInfo.ampCh6,
          toKey: 'a_ch_6',
        },
        {
          fromKey: sensorKeyInfo.volCh6,
          toKey: 'v_ch_6',
        },
      ],
    },
    troubleTableInfo: {
      tableName: 'pw_connector_trouble_data',
      insertDateColumn: 'writedate',
      fromToKeyTableList: [
        {
          fromKey: 'connector_seq',
          toKey: 'connector_seq',
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
        primaryKey: 'connector_trouble_data_seq',
        foreignKey: 'connector_seq',
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
