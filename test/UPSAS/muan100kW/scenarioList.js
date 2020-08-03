const CoreFacade = require('../../../src/core/CoreFacade');

const rainScenario = require('./rainScenario');

const { dcmConfigModel } = CoreFacade;

const {
  commandStep: cmdStep,
  goalDataRange: goalDR,
  reqWrapCmdType: reqWCT,
  reqWrapCmdFormat: reqWCF,
  reqDeviceControlType: reqDCT,
} = dcmConfigModel;

/** @type {mScenarioInfo[]} */
const scenarioList = [
  {
    scenarioId: 'rainMode2',
    scenarioList: [
      // 모든 장치 닫기
      {
        wrapCmdFormat: reqWCF.SET,
        wrapCmdType: reqWCT.CONTROL,
        setCmdId: 'closeAllDevice',
      },
      // 염수 대피
      [
        // 결정지 염수 이동
        [
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              goalDataList: [
                {
                  nodeId: 'WL_017',
                  goalValue: 1,
                  goalRange: goalDR.LOWER,
                },
              ],
            },
            flowSrcPlaceId: 'NCB',
            flowDestPlaceId: 'BW_5',
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            flowSrcPlaceId: 'NCB',
            flowDestPlaceId: 'SEA',
          },
        ],
        // 수중 태양광 증발지 그룹 2 염수 이동
        [
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              goalDataList: [
                {
                  nodeId: 'WL_014',
                  goalValue: 2,
                  goalRange: goalDR.LOWER,
                },
                {
                  nodeId: 'WL_015',
                  goalValue: 2,
                  goalRange: goalDR.LOWER,
                },
                {
                  nodeId: 'WL_016',
                  goalValue: 2,
                  goalRange: goalDR.LOWER,
                },
              ],
            },
            flowSrcPlaceId: 'SEB_TWO',
            flowDestPlaceId: 'BW_3',
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            flowSrcPlaceId: 'SEB_TWO',
            flowDestPlaceId: 'SEA',
          },
        ],
        // 수중 태양광 증발지 그룹 1 염수 이동
        [
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              goalDataList: [
                {
                  nodeId: 'WL_009',
                  goalValue: 2,
                  goalRange: goalDR.LOWER,
                },
                {
                  nodeId: 'WL_010',
                  goalValue: 2,
                  goalRange: goalDR.LOWER,
                },
                {
                  nodeId: 'WL_011',
                  goalValue: 2,
                  goalRange: goalDR.LOWER,
                },
                {
                  nodeId: 'WL_012',
                  goalValue: 2,
                  goalRange: goalDR.LOWER,
                },
                {
                  nodeId: 'WL_013',
                  goalValue: 2,
                  goalRange: goalDR.LOWER,
                },
              ],
            },
            flowSrcPlaceId: 'SEB_ONE',
            flowDestPlaceId: 'BW_2',
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            flowSrcPlaceId: 'SEB_ONE',
            flowDestPlaceId: 'SEA',
          },
        ],
        // 일반 증발지 2 염수 이동
        [
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              goalDataList: [
                {
                  nodeId: 'WL_004',
                  goalValue: 2,
                  goalRange: goalDR.LOWER,
                },
              ],
            },
            flowSrcPlaceId: 'NEB_2',
            flowDestPlaceId: 'BW_1',
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            flowSrcPlaceId: 'NEB_2',
            flowDestPlaceId: 'SEA',
          },
        ],
        // 일반 증발지 1 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          wrapCmdType: reqWCT.CONTROL,
          flowSrcPlaceId: 'NEB_1',
          flowDestPlaceId: 'SEA',
        },
      ],
      // 바다로 ~
      {
        wrapCmdFormat: reqWCF.SET,
        wrapCmdType: reqWCT.CONTROL,
        setCmdId: 'rainMode',
      },
    ],
  },
  {
    scenarioId: 'normalFlowScenario',
    scenarioName: '소금 생산 시나리오',
    scenarioList: [
      // 모든 장치 닫기
      {
        wrapCmdFormat: reqWCF.SET,
        wrapCmdType: reqWCT.CONTROL,
        setCmdId: 'closeAllDevice',
      },
      // 저수지 2 > 저수지 1 염수 이동
      [
        [
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'RV_2',
            flowDestPlaceId: 'RV_1',
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CANCEL,
            flowSrcPlaceId: 'RV_2',
            flowDestPlaceId: 'RV_1',
          },
        ],
      ],
      // 저수지 1 > 일반 증발지 1, 2 염수 이동 및 염도 이동
      [
        [
          // 저수지 1 > 일반 증발지 1, 2 염수 이동
          {
            wrapCmdFormat: reqWCF.SINGLE,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            singleNodeId: ['P_001', 'WD_002', 'WD_003'],
            singleControlType: reqDCT.TRUE,
          },
          // 염도가 적정 수준에 오르기를 기다림
          {
            wrapCmdFormat: reqWCF.SINGLE,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            singleNodeId: ['P_001', 'WD_002', 'WD_003'],
            singleControlType: reqDCT.FALSE,
          },
          // 염도에 의한 염수 이동
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'NEB_2',
            flowDestPlaceId: 'BW_2',
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CANCEL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'NEB_2',
            flowDestPlaceId: 'BW_2',
          },
        ],
      ],
      // 염도에 의한 수중 태양광 증발지 염수 이동 1단계
      [
        [
          // 해주 2 > 수중 태양광 증발지 그룹 1 염수 이동
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'BW_2',
            flowDestPlaceId: 'SEB_ONE',
          },
          // 수중 태양광 증발지 그룹 1의 염도 달성 대기
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CANCEL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'BW_2',
            flowDestPlaceId: 'SEB_ONE',
          },
          // 염도 달성: 수중 태양광 증발지 그룹 1 > 해주 3
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'SEB_ONE',
            flowDestPlaceId: 'BW_3',
          },
          // 염수 이동 완료
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CANCEL,
            flowSrcPlaceId: 'SEB_ONE',
            flowDestPlaceId: 'BW_3',
          },
        ],
      ],
      // 염도에 의한 수중 태양광 증발지 염수 이동 2단계
      [
        [
          // 해주 3 > 수중 태양광 증발지 그룹 2
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'BW_3',
            flowDestPlaceId: 'SEB_TWO',
          },
          // 염도 달성 대기
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CANCEL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'BW_3',
            flowDestPlaceId: 'SEB_TWO',
          },
          // 염도 달성: 수중태양광 증발지 그룹 2 > 해주 4
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'SEB_TWO',
            flowDestPlaceId: 'BW_4',
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CANCEL,
            flowSrcPlaceId: 'SEB_TWO',
            flowDestPlaceId: 'BW_4',
          },
          // 해주 4 > 결정지 해주로 이동
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'BW_4',
            flowDestPlaceId: 'BW_5',
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CANCEL,
            flowSrcPlaceId: 'BW_4',
            flowDestPlaceId: 'BW_5',
          },
        ],
      ],
      // 결정지 소금 생산
      [
        [
          // 해주 5 > 결정지 염수 이동
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'BW_5',
            flowDestPlaceId: 'NCB',
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CANCEL,
            flowSrcPlaceId: 'BW_5',
            flowDestPlaceId: 'NCB',
          },
        ],
      ],
    ],
  },
  {
    scenarioId: 'VIP',
    scenarioName: '소금 생산 시나리오',
    scenarioList: [
      // 모든 장치 닫기
      {
        wrapCmdFormat: reqWCF.SET,
        wrapCmdType: reqWCT.CONTROL,
        setCmdId: 'closeAllDevice',
      },
      // 저수지 1 > 저수지 1 염수 이동
      [
        [
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'RV_1',
            flowDestPlaceId: 'NEB_1',
            imgDisplayList: [
              {
                cmdStep: cmdStep.PROCEED,
                imgId: 'flowToNormalEvaporationA',
              },
              {
                cmdStep: cmdStep.END,
                imgId: 'flowToNormalEvaporationA',
                isAppear: 0,
              },
            ],
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'NEB_1',
            flowDestPlaceId: 'NEB_2',
            imgDisplayList: [
              {
                cmdStep: cmdStep.PROCEED,
                imgId: 'flowToNormalEvaporationB',
              },
              {
                cmdStep: cmdStep.END,
                imgId: 'flowToNormalEvaporationB',
                isAppear: 0,
              },
            ],
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'NEB_2',
            flowDestPlaceId: 'BW_2',
            imgDisplayList: [
              {
                cmdStep: cmdStep.PROCEED,
                imgId: 'flowToBrineWarehouseA',
              },
              {
                cmdStep: cmdStep.END,
                imgId: 'flowToBrineWarehouseA',
                isAppear: 0,
              },
            ],
          },
        ],
      ],
      [
        [
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'BW_2',
            flowDestPlaceId: 'SEB_ONE',
            imgDisplayList: [
              {
                cmdStep: cmdStep.PROCEED,
                imgId: 'flowToModule',
              },
              {
                cmdStep: cmdStep.END,
                imgId: 'flowToModule',
                isAppear: 0,
              },
            ],
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'BW_5',
            flowDestPlaceId: 'NCB',
            imgDisplayList: [
              {
                cmdStep: cmdStep.PROCEED,
                imgId: 'flowToNormalCrystal',
              },
              {
                cmdStep: cmdStep.END,
                imgId: 'flowToNormalCrystal',
                isAppear: 0,
              },
            ],
          },
        ],
        [
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'BW_3',
            flowDestPlaceId: 'SEB_TWO',
          },
        ],
      ],
      // 결정지 소금 생산
      [
        [
          // 해주 5 > 결정지 염수 이동
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CONTROL,
            wrapCmdGoalInfo: {
              limitTimeSec: 5,
            },
            flowSrcPlaceId: 'BW_5',
            flowDestPlaceId: 'NCB',
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            wrapCmdType: reqWCT.CANCEL,
            flowSrcPlaceId: 'BW_5',
            flowDestPlaceId: 'NCB',
          },
        ],
      ],
    ],
  },
  {
    scenarioId: 'rainMode',
    scenarioName: '우천 모드',
    scenarioList: [
      // 모든 장치 닫기
      {
        wrapCmdFormat: reqWCF.SET,
        wrapCmdType: reqWCT.CONTROL,
        setCmdId: 'closeAllDevice',
      },
      // 염수 대피
      [
        // 결정지 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          wrapCmdType: reqWCT.CONTROL,
          flowSrcPlaceId: 'NCB',
          flowDestPlaceId: 'BW_5',
          wrapCmdGoalInfo: {
            limitTimeSec: 10,
          },
          imgDisplayList: [
            {
              cmdStep: cmdStep.PROCEED,
              imgId: 'rainMode',
            },
          ],
        },
        // 수중 태양광 증발지 그룹 2 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          wrapCmdType: reqWCT.CONTROL,
          flowSrcPlaceId: 'SEB_TWO',
          flowDestPlaceId: 'BW_3',
          wrapCmdGoalInfo: {
            limitTimeSec: 10,
          },
        },
        // 수중 태양광 증발지 그룹 1 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          wrapCmdType: reqWCT.CONTROL,
          flowSrcPlaceId: 'SEB_ONE',
          flowDestPlaceId: 'BW_2',
          wrapCmdGoalInfo: {
            limitTimeSec: 10,
          },
          imgDisplayList: [
            {
              cmdStep: cmdStep.END,
              imgId: 'rainMode',
              isAppear: 0,
            },
          ],
        },
        // 일반 증발지 2 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          wrapCmdType: reqWCT.CONTROL,
          flowSrcPlaceId: 'NEB_2',
          flowDestPlaceId: 'BW_1',
          wrapCmdGoalInfo: {
            limitTimeSec: 10,
          },
        },
      ],
    ],
  },
];

// module.exports = Object.assign(scenarioList, rainScenario);
module.exports = scenarioList.concat(rainScenario);
