require('../../../src/features/BlockManager/block.jsdoc');

const {
  BaseModel: { Inverter, FarmParallel },
} = require('../../../src/module').dpc;

const inverterKeyInfo = Inverter.BASE_KEY;
const farmKeyInfo = FarmParallel.BASE_KEY;

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
          toKey: 'power_total_kwh',
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
    blockCategory: 'farmSensor',
    baseTableInfo: {
      tableName: 'v_dv_place',
      idKey: 'place_real_id',
      placeKey: 'place_seq',
      placeClassKeyList: ['farmParallelSite', 'outside'],
      fromToKeyTableList: [
        {
          fromKey: 'place_seq',
          toKey: 'place_seq',
        },
      ],
    },
    applyTableInfo: {
      tableName: 'farm_sensor_data',
      insertDateColumn: 'writedate',
      matchingList: [
        {
          fromKey: farmKeyInfo.pvRearTemperature,
          toKey: 'pv_rear_temp',
        },
        {
          fromKey: farmKeyInfo.pvUnderlyingSolar,
          toKey: 'pv_under_solar',
        },
        {
          fromKey: farmKeyInfo.inclinedSolar,
          toKey: 'inclined_solar',
        },
        {
          fromKey: farmKeyInfo.lux,
          toKey: 'lux',
        },
        {
          fromKey: farmKeyInfo.co2,
          toKey: 'co2',
        },
        {
          fromKey: farmKeyInfo.soilWaterValue,
          toKey: 'soil_ec',
        },
        {
          fromKey: farmKeyInfo.soilTemperature,
          toKey: 'soil_temp',
        },
        {
          fromKey: farmKeyInfo.soilReh,
          toKey: 'soil_reh',
        },
        {
          fromKey: farmKeyInfo.outsideAirTemperature,
          toKey: 'oa_temp',
        },
        {
          fromKey: farmKeyInfo.outsideAirReh,
          toKey: 'oa_reh',
        },
        {
          fromKey: farmKeyInfo.horizontalSolar,
          toKey: 'horizontal_solar',
        },
        {
          fromKey: farmKeyInfo.windSpeed,
          toKey: 'oa_ws',
        },
        {
          fromKey: farmKeyInfo.windDirection,
          toKey: 'oa_wd',
        },
        {
          fromKey: farmKeyInfo.r1,
          toKey: 'oa_r1',
        },
        {
          fromKey: farmKeyInfo.isRain,
          toKey: 'oa_is_rain',
        },
      ],
    },
    troubleTableInfo: {},
  },
];
module.exports = blockConfigInfo;
