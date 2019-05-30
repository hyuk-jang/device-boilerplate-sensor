const {
  dcmConfigModel: { controlModeInfo, reqWrapCmdType, reqDeviceControlType: reqDCT },
} = require('../../../../default-intelligence');

/** @type {complexCmdWrapInfo[]} */
const wrapCmdList = [
  {
    wrapCmdId: 'A_TO_B',
    wrapCmdUUID: 'A_TO_B',
    wrapCmdType: reqWrapCmdType.CONTROL,
    containerCmdList: [
      {
        singleControlType: reqDCT.FALSE,
        eleCmdList: [
          {
            nodeId: 'WD_001',
            uuid: 'WD_001_UUID',
          },
          {
            nodeId: 'WD_002',
            uuid: 'WD_002_UUID',
          },
        ],
      },
      {
        singleControlType: reqDCT.TRUE,
        eleCmdList: [
          {
            nodeId: 'WD_003',
            uuid: 'WD_003_UUID',
          },
        ],
      },
    ],
    realContainerCmdList: [
      {
        singleControlType: reqDCT.FALSE,
        eleCmdList: [
          {
            nodeId: 'WD_001',
            uuid: 'WD_001_UUID',
          },
          {
            nodeId: 'WD_002',
            uuid: 'WD_002_UUID',
          },
        ],
      },
      {
        singleControlType: reqDCT.TRUE,
        eleCmdList: [
          {
            nodeId: 'WD_003',
            uuid: 'WD_003_UUID',
          },
        ],
      },
    ],
  },
  {
    wrapCmdId: 'A_TO_C',
    wrapCmdUUID: 'A_TO_C',
    wrapCmdType: reqWrapCmdType.CONTROL,
    containerCmdList: [
      {
        singleControlType: reqDCT.FALSE,
        eleCmdList: [
          {
            nodeId: 'WD_001',
            uuid: 'WD_001_UUID',
          },
        ],
      },
      {
        singleControlType: reqDCT.TRUE,
        eleCmdList: [
          {
            nodeId: 'WD_004',
            uuid: 'WD_004_UUID',
          },
        ],
      },
    ],
    realContainerCmdList: [
      {
        singleControlType: reqDCT.FALSE,
        eleCmdList: [
          {
            nodeId: 'WD_001',
            uuid: 'WD_001_UUID',
          },
        ],
      },
      {
        singleControlType: reqDCT.TRUE,
        eleCmdList: [
          {
            nodeId: 'WD_004',
            uuid: 'WD_004_UUID',
          },
        ],
      },
    ],
  },
  {
    wrapCmdId: 'B_TO_A',
    wrapCmdUUID: 'B_TO_A',
    wrapCmdType: reqWrapCmdType.CONTROL,
    containerCmdList: [
      {
        singleControlType: reqDCT.FALSE,
        eleCmdList: [
          {
            nodeId: 'WD_003',
            uuid: 'WD_003_UUID',
          },
        ],
      },
      {
        singleControlType: reqDCT.TRUE,
        eleCmdList: [
          {
            nodeId: 'WD_001',
            uuid: 'WD_001_UUID',
          },
          {
            nodeId: 'WD_002',
            uuid: 'WD_002_UUID',
          },
        ],
      },
    ],
    realContainerCmdList: [
      {
        singleControlType: reqDCT.FALSE,
        eleCmdList: [
          {
            nodeId: 'WD_003',
            uuid: 'WD_003_UUID',
          },
        ],
      },
      {
        singleControlType: reqDCT.TRUE,
        eleCmdList: [
          {
            nodeId: 'WD_001',
            uuid: 'WD_001_UUID',
          },
          {
            nodeId: 'WD_002',
            uuid: 'WD_002_UUID',
          },
        ],
      },
    ],
  },
];

/** @type {nodeInfo[]} */
const nodeList = [
  {
    node_id: 'WD_001',
    is_sensor: 0,
  },
  {
    node_id: 'WD_002',
    is_sensor: 0,
  },
  {
    node_id: 'WD_003',
    is_sensor: 0,
  },
  {
    node_id: 'WD_004',
    is_sensor: 0,
  },
];

module.exports = { wrapCmdList, nodeList };
