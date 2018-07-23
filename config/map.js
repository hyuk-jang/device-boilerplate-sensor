require('./map.jsdoc');

/**
 * @type {deviceMap}
 */
const map = {
  drawInfo: {
    frame: {
      mapSize: {
        width: 880,
        height: 1230,
      },
      svgModelResourceList: [
        {
          id: 'salternBlock_001',
          type: 'rect',
          elementDrawInfo: {
            width: 100,
            height: 150,
            color: '#33ffff',
          },
        },
        {
          id: 'salternBlock_002',
          type: 'rect',
          elementDrawInfo: {
            width: 100,
            height: 150,
            color: '#33ffff',
          },
        },
        {
          id: 'salternLine_001',
          type: 'line',
          elementDrawInfo: {
            strokeWidth: 100,
            color: '#33ccff',
          },
        },
        {
          id: 'pump_001',
          type: 'circle',
          elementDrawInfo: {
            radius: 20,
            color: '#9fe667',
          },
        },
        {
          id: 'valve_001',
          type: 'squares',
          elementDrawInfo: {
            radius: 20,
            color: '#efb4ce',
          },
        },
      ],
    },
    positionList: [{}],
  },
  setInfo: {
    connectInfoList: [
      {
        // type: 'socket',
        type: 'zigbee',
        subType: 'xbee',
        baudRate: 9600,
        // port: 9000,
        port: 'COM2',
        deviceRouterList: [],
      },
    ],
    modelInfo: {},
  },
  realtionInfo: {},
  controlList: [
    {
      cmdName: '바다 → 저수지',
      trueList: ['P_001'],
      falseList: [],
    },
    {
      cmdName: '저수조 → 증발지 1',
      trueList: ['V_006', 'V_001', 'V_002', 'V_003', 'V_004', 'P_002'],
      falseList: ['GV_001', 'GV_002', 'GV_003', 'GV_004', 'WD_005'],
    },
    {
      cmdName: '해주 1 → 증발지 1',
      trueList: ['V_007', 'V_001', 'V_002', 'V_003', 'V_004', 'P_003'],
      falseList: ['GV_001', 'GV_002', 'GV_003', 'GV_004', 'WD_005'],
    },
    {
      cmdName: '해주 2 → 증발지 2',
      trueList: ['P_004'],
      falseList: ['WD_006'],
    },
    {
      cmdName: '해주 2 → 증발지 2, 3, 4',
      trueList: ['P_004', 'WD_006', 'WD_007'],
      falseList: ['WD_008'],
    },
    {
      cmdName: '해주 3 → 결정지',
      trueList: ['P_005'],
      falseList: ['WD_009'],
    },

    {
      cmdName: '증발지 1 → 해주 1',
      trueList: ['GV_001', 'GV_002', 'GV_003', 'GV_004', 'WD_005', 'WD_013', 'WD_010'],
      falseList: ['WD_016'],
    },
    {
      cmdName: '증발지 1 → 해주 2',
      trueList: ['GV_001', 'GV_002', 'GV_003', 'GV_004', 'WD_005', 'WD_013', 'WD_016', 'WD_011'],
      falseList: ['WD_010', 'WD_012', 'WD_014', 'WD_015'],
    },
    {
      cmdName: '증발지 2 → 증발지 3',
      trueList: ['WD_006'],
      falseList: ['WD_007'],
    },
    {
      cmdName: '증발지 3 → 증발지 4',
      trueList: ['WD_007'],
      falseList: ['WD_008'],
    },
    {
      cmdName: '증발지 4 → 해주2',
      trueList: ['WD_008', 'WD_014', 'WD_011'],
      falseList: ['WD_012', 'WD_015'],
    },
    {
      cmdName: '증발지 4 → 해주3',
      trueList: ['WD_008', 'WD_014', 'WD_012'],
      falseList: ['WD_011', 'WD_015'],
    },
    {
      cmdName: '결정지 → 해주 3',
      trueList: ['WD_009', 'WD_014', 'WD_012'],
      falseList: ['WD_011'],
    },

    {
      cmdName: '저수조 → 증발지 1A',
      trueList: ['V_006', 'V_001', 'P_002'],
      falseList: ['GV_001'],
    },
    {
      cmdName: '저수조 → 증발지 1B',
      trueList: ['V_006', 'V_002', 'P_002'],
      falseList: ['GV_002'],
    },
    {
      cmdName: '저수조 → 증발지 1C',
      trueList: ['V_006', 'V_003', 'P_002'],
      falseList: ['GV_003'],
    },
    {
      cmdName: '저수조 → 증발지 1D',
      trueList: ['V_006', 'V_004', 'P_002'],
      falseList: ['GV_004'],
    },
    {
      cmdName: '해주 1 → 증발지 1A',
      trueList: ['V_007', 'V_001', 'P_003'],
      falseList: ['GV_001'],
    },
    {
      cmdName: '해주 1 → 증발지 1B',
      trueList: ['V_007', 'V_002', 'P_003'],
      falseList: ['GV_002'],
    },
    {
      cmdName: '해주 1 → 증발지 1C',
      trueList: ['V_007', 'V_003', 'P_003'],
      falseList: ['GV_003'],
    },
    {
      cmdName: '해주 1 → 증발지 1D',
      trueList: ['V_007', 'V_004', 'P_003'],
      falseList: ['GV_004'],
    },

    {
      cmdName: '증발지 1A → 해주 1',
      trueList: ['GV_001', 'WD_013', 'WD_010'],
      falseList: [],
    },
    {
      cmdName: '증발지 1B → 해주 1',
      trueList: ['GV_002', 'WD_013', 'WD_010'],
      falseList: [],
    },
    {
      cmdName: '증발지 1C → 해주 1',
      trueList: ['GV_003', 'WD_013', 'WD_010'],
      falseList: [],
    },
    {
      cmdName: '증발지 1D → 해주 1',
      trueList: ['GV_004', 'WD_013', 'WD_010'],
      falseList: [],
    },
  ],
};

module.exports = map;
