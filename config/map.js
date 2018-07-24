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
        deviceRouterList: [
          {
            targetId: 'R_GV_001',
            deviceId: '0013A20040F7AB81',
            nodeModelList: ['GV_001', 'WL_001'],
          },
          {
            targetId: 'R_GV_002',
            deviceId: '0013A20040F7AB76',
            nodeModelList: ['GV_002', 'WL_002'],
          },
          {
            targetId: 'R_GV_003',
            deviceId: '0013A20040F7AB69',
            nodeModelList: ['GV_003', 'WL_003'],
          },
          {
            targetId: 'R_GV_004',
            deviceId: '0013A20040F7AB96',
            nodeModelList: ['GV_004', 'WL_004'],
          },
          {
            targetId: 'R_EP_001',
            deviceId: '0013A20040F7AB86',
            nodeModelList: ['MRT_005', 'MRT_005'],
          },
          {
            targetId: 'R_G_005',
            deviceId: '0013A20040F7ACC8',
            nodeModelList: ['WD_005'],
          },
          {
            targetId: 'R_G_006',
            deviceId: '0013A20040F7B486',
            nodeModelList: ['WD_006'],
          },
          {
            targetId: 'R_G_007',
            deviceId: '0013A20040F7B47C',
            nodeModelList: ['WD_007'],
          },
          {
            targetId: 'R_G_008',
            deviceId: '0013A20040F7AB9C',
            nodeModelList: ['WD_008'],
          },
          {
            targetId: 'R_G_009',
            deviceId: '0013A20040F7B430',
            nodeModelList: ['WD_009'],
          },
          {
            targetId: 'R_G_010',
            deviceId: '0013A20040F7AB7D',
            nodeModelList: ['WD_010'],
          },
          {
            targetId: 'R_G_011',
            deviceId: '0013A20040F7B4A9',
            nodeModelList: ['WD_011'],
          },
          {
            targetId: 'R_G_012',
            deviceId: '0013A20040F7B460',
            nodeModelList: ['WD_012'],
          },
          {
            targetId: 'R_G_013',
            deviceId: '0013A20040F7B49B',
            nodeModelList: ['WD_013'],
          },
          {
            targetId: 'R_G_014',
            deviceId: '0013A20040F7B453',
            nodeModelList: ['WD_014'],
          },
          {
            targetId: 'R_G_015',
            deviceId: '0013A20040F7B474',
            nodeModelList: ['WD_015'],
          },
          {
            targetId: 'R_G_016',
            deviceId: '0013A20040F7AB98',
            nodeModelList: ['WD_016'],
          },
          {
            targetId: 'R_V_001',
            deviceId: '0013A20040F7B47F',
            nodeModelList: ['V_001', 'MRT_001'],
          },
          {
            targetId: 'R_V_002',
            deviceId: '0013A20040F7B4A4',
            nodeModelList: ['V_002', 'MRT_002'],
          },
          {
            targetId: 'R_V_003',
            deviceId: '0013A20040F7B455',
            nodeModelList: ['V_003', 'MRT_003'],
          },
          {
            targetId: 'R_V_004',
            deviceId: '0013A20040F7B43C',
            nodeModelList: ['V_004', 'MRT_004'],
          },
          {
            targetId: 'R_V_006',
            deviceId: '0013A20040F7B469',
            nodeModelList: ['V_006'],
          },
          {
            targetId: 'R_V_007',
            deviceId: '0013A20040F7B4A7',
            nodeModelList: ['V_007'],
          },
          {
            targetId: 'R_P_001',
            deviceId: '0013A20040F7B451',
            nodeModelList: ['P_001'],
          },
          {
            targetId: 'R_P_002',
            deviceId: '0013A20040F7B446',
            nodeModelList: ['P_002'],
          },
          {
            targetId: 'R_P_003',
            deviceId: '0013A20040F7B44A',
            nodeModelList: ['P_003'],
          },
          {
            targetId: 'R_P_004',
            deviceId: '0013A20040F7A4E0',
            nodeModelList: ['P_004'],
          },
          {
            targetId: 'R_P_005',
            deviceId: '0013A20040F7A4D8',
            nodeModelList: ['P_005'],
          },
        ],
      },
    ],
    modelInfo: {
      waterDoor: [
        {
          targetId: 'WD_005',
          targetName: '수문5',
        },
        {
          targetId: 'WD_006',
          targetName: '수문6',
        },
        {
          targetId: 'WD_007',
          targetName: '수문7',
        },
        {
          targetId: 'WD_008',
          targetName: '수문8',
        },
        {
          targetId: 'WD_009',
          targetName: '수문9',
        },
        {
          targetId: 'WD_010',
          targetName: '수문10',
        },
        {
          targetId: 'WD_011',
          targetName: '수문11',
        },
        {
          targetId: 'WD_012',
          targetName: '수문12',
        },
        {
          targetId: 'WD_013',
          targetName: '수문13',
        },
        {
          targetId: 'WD_014',
          targetName: '수문14',
        },
        {
          targetId: 'WD_015',
          targetName: '수문15',
        },
        {
          targetId: 'WD_016',
          targetName: '수문16',
        },
      ],
      valve: [
        {
          targetId: 'V_001',
          targetName: '밸브1',
        },
        {
          targetId: 'V_002',
          targetName: '밸브2',
        },
        {
          targetId: 'V_003',
          targetName: '밸브3',
        },
        {
          targetId: 'V_004',
          targetName: '밸브4',
        },
        {
          targetId: 'V_006',
          targetName: '밸브6',
        },
        {
          targetId: 'V_007',
          targetName: '밸브7',
        },
        {
          targetId: 'GV_001',
          targetName: '수문1',
        },
        {
          targetId: 'GV_002',
          targetName: '수문2',
        },
        {
          targetId: 'GV_003',
          targetName: '수문3',
        },
        {
          targetId: 'GV_004',
          targetName: '수문4',
        },
      ],
      pump: [
        {
          targetId: 'P_001',
          targetName: '펌프1',
        },
        {
          targetId: 'P_002',
          targetName: '펌프2',
        },
        {
          targetId: 'P_003',
          targetName: '펌프3',
        },
        {
          targetId: 'P_004',
          targetName: '펌프4',
        },
        {
          targetId: 'P_005',
          targetName: '펌프5',
        },
      ],
      waterLevel: [
        {
          targetId: 'WL_001',
          targetName: '수위1',
        },
        {
          targetId: 'WL_002',
          targetName: '수위2',
        },
        {
          targetId: 'WL_003',
          targetName: '수위3',
        },
        {
          targetId: 'WL_004',
          targetName: '수위4',
        },
      ],
      moduleRearTemperature: [
        {
          targetId: 'MRT_001',
          targetName: '모듈온도 1',
        },
        {
          targetId: 'MRT_002',
          targetName: '모듈온도 2',
        },
        {
          targetId: 'MRT_003',
          targetName: '모듈온도 3',
        },
        {
          targetId: 'MRT_004',
          targetName: '모듈온도 4',
        },
        {
          targetId: 'MRT_005',
          targetName: '모듈온도 5',
        },
        {
          targetId: 'MRT_006',
          targetName: '모듈온도 6',
        },
      ],
    },
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
