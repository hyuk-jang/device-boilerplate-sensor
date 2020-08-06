const CoreFacade = require('../../../src/core/CoreFacade');

const { dcmConfigModel } = CoreFacade;

const {
  commandStep: cmdStep,
  goalDataRange: goalDR,
  reqWrapCmdType: reqWCT,
  reqWrapCmdFormat: reqWCF,
  reqDeviceControlType: reqDCT,
} = dcmConfigModel;

const ONE_MIN = 1;

const LIMIT_TIME = {
  evacuation: ONE_MIN * 30,
  normalBlockRestore: ONE_MIN * 30,
  // 2cm 4분 20초
  uwBlockRestoreTwo: ONE_MIN * 4.3,
  // 3cm 7분
  uwBlockRestoreThree: ONE_MIN * 7,
  // 4cm 10분
  uwBlockRestoreFour: ONE_MIN * 10,
  // 4cm 13분 20초
  uwBlockRestoreFive: ONE_MIN * 13.3,
};

/** @type {mScenarioInfo[]} */
module.exports = [
  {
    scenarioId: 'rainEvacuation',
    scenarioName: '우천 대피',
    scenarioList: [
      // 모든 장치 닫기
      {
        wrapCmdFormat: reqWCF.SET,
        setCmdId: 'closeAllDevice',
      },
      // 염수 대피
      [
        // 결정지 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'NCB',
          flowDestPlaceId: 'BW_5',
          wrapCmdGoalInfo: {
            limitTimeSec: LIMIT_TIME.evacuation,
          },
        },
        // 수중 태양광 증발지 그룹 2 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'SEB_TWO',
          flowDestPlaceId: 'BW_3',
          wrapCmdGoalInfo: {
            limitTimeSec: LIMIT_TIME.evacuation,
          },
        },
        // 수중 태양광 증발지 그룹 1 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'SEB_ONE',
          flowDestPlaceId: 'BW_2',
          wrapCmdGoalInfo: {
            limitTimeSec: LIMIT_TIME.evacuation,
          },
        },
        // 일반 증발지 2 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'NEB_2',
          flowDestPlaceId: 'BW_1',
          wrapCmdGoalInfo: {
            limitTimeSec: LIMIT_TIME.evacuation,
          },
        },
      ],
    ],
  },
  {
    scenarioId: 'rainRelease',
    scenarioName: '우천 배출',
    scenarioList: [
      // 모든 장치 닫기
      {
        wrapCmdFormat: reqWCF.SET,
        setCmdId: 'closeAllDevice',
      },
      // 염수 배출
      [
        // 결정지 염수 배출
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'NCB',
          flowDestPlaceId: 'SEA',
        },
        // 수중 태양광 증발지 그룹 2 염수 배출
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'SEB_TWO',
          flowDestPlaceId: 'SEA',
        },
        // 수중 태양광 증발지 그룹 1 염수 배출
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'SEB_ONE',
          flowDestPlaceId: 'SEA',
        },
        // 일반 증발지 2 염수 배출
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'NEB_2',
          flowDestPlaceId: 'SEA',
        },
        // 일반 증발지 1 염수 배출
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'NEB_1',
          flowDestPlaceId: 'SEA',
        },
      ],
    ],
  },
  {
    scenarioId: 'rainEvaRelease',
    scenarioName: '우천 모드',
    scenarioList: [
      // 모든 장치 닫기
      {
        wrapCmdFormat: reqWCF.SET,
        setCmdId: 'closeAllDevice',
      },
      // 염수 대피
      [
        // 결정지 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'NCB',
          flowDestPlaceId: 'BW_5',
          wrapCmdGoalInfo: {
            limitTimeSec: LIMIT_TIME.evacuation,
          },
        },
        // 수중 태양광 증발지 그룹 2 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'SEB_TWO',
          flowDestPlaceId: 'BW_3',
          wrapCmdGoalInfo: {
            limitTimeSec: LIMIT_TIME.evacuation,
          },
        },
        // 수중 태양광 증발지 그룹 1 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'SEB_ONE',
          flowDestPlaceId: 'BW_2',
          wrapCmdGoalInfo: {
            limitTimeSec: LIMIT_TIME.evacuation,
          },
        },
        // 일반 증발지 2 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'NEB_2',
          flowDestPlaceId: 'BW_1',
          wrapCmdGoalInfo: {
            limitTimeSec: LIMIT_TIME.evacuation,
          },
        },
      ],
      // 염수 배출
      [
        // 결정지 염수 배출
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'NCB',
          flowDestPlaceId: 'SEA',
        },
        // 수중 태양광 증발지 그룹 2 염수 배출
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'SEB_TWO',
          flowDestPlaceId: 'SEA',
        },
        // 수중 태양광 증발지 그룹 1 염수 배출
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'SEB_ONE',
          flowDestPlaceId: 'SEA',
        },
        // 일반 증발지 2 염수 배출
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'NEB_2',
          flowDestPlaceId: 'SEA',
        },
        // 일반 증발지 1 염수 배출
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'NEB_1',
          flowDestPlaceId: 'SEA',
        },
      ],
    ],
  },
  {
    scenarioId: 'rainRestore',
    scenarioName: '우천 복원',
    scenarioList: [
      // 모든 장치 닫기
      {
        wrapCmdFormat: reqWCF.SET,
        setCmdId: 'closeAllDevice',
      },
      // 저수지 1 > 일반 증발지 1, 2 염수 이동 및 염도 이동
      [
        // 저수지 1 > 일반 증발지 1 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          wrapCmdGoalInfo: {
            limitTimeSec: LIMIT_TIME.normalBlockRestore,
          },
          flowSrcPlaceId: 'RV_1',
          flowDestPlaceId: 'NEB_1',
        },
        // 해주 1 > 일반 증발지 2 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          wrapCmdGoalInfo: {
            limitTimeSec: LIMIT_TIME.normalBlockRestore,
          },
          flowSrcPlaceId: 'BW_1',
          flowDestPlaceId: 'NEB_2',
        },
        // 해주 2 > 수증 1그룹 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          wrapCmdGoalInfo: {
            limitTimeSec: LIMIT_TIME.uwBlockRestoreThree,
          },
          flowSrcPlaceId: 'BW_2',
          flowDestPlaceId: 'SEB_ONE',
        },
        // 해주 3 > 수증 2그룹 염수 이동
        {
          wrapCmdFormat: reqWCF.FLOW,
          wrapCmdGoalInfo: {
            limitTimeSec: LIMIT_TIME.uwBlockRestoreThree,
          },
          flowSrcPlaceId: 'BW_3',
          flowDestPlaceId: 'SEB_TWO',
        },
      ],
    ],
  },
  {
    scenarioId: 'rainEvaReleaseStep',
    scenarioName: '우천 모드',
    scenarioList: [
      // 염수 대피
      [
        // 결정지 염수 이동
        [
          {
            wrapCmdFormat: reqWCF.FLOW,
            flowSrcPlaceId: 'NCB',
            flowDestPlaceId: 'BW_5',
            wrapCmdGoalInfo: {
              limitTimeSec: LIMIT_TIME.evacuation,
            },
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            flowSrcPlaceId: 'NCB',
            flowDestPlaceId: 'SEA',
          },
        ],
        // 수중 태양광 증발지 그룹 2 염수 이동
        [
          {
            wrapCmdFormat: reqWCF.FLOW,
            flowSrcPlaceId: 'SEB_TWO',
            flowDestPlaceId: 'BW_3',
            wrapCmdGoalInfo: {
              limitTimeSec: LIMIT_TIME.evacuation,
            },
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            flowSrcPlaceId: 'SEB_TWO',
            flowDestPlaceId: 'SEA',
          },
        ],
        // 수중 태양광 증발지 그룹 1 염수 이동
        [
          {
            wrapCmdFormat: reqWCF.FLOW,
            flowSrcPlaceId: 'SEB_ONE',
            flowDestPlaceId: 'BW_2',
            wrapCmdGoalInfo: {
              limitTimeSec: LIMIT_TIME.evacuation,
            },
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            flowSrcPlaceId: 'SEB_ONE',
            flowDestPlaceId: 'SEA',
          },
        ],
        // 일반 증발지 2 염수 이동
        [
          {
            wrapCmdFormat: reqWCF.FLOW,
            flowSrcPlaceId: 'NEB_2',
            flowDestPlaceId: 'BW_1',
            wrapCmdGoalInfo: {
              limitTimeSec: LIMIT_TIME.evacuation,
            },
          },
          {
            wrapCmdFormat: reqWCF.FLOW,
            flowSrcPlaceId: 'NEB_2',
            flowDestPlaceId: 'SEA',
          },
        ],
        {
          wrapCmdFormat: reqWCF.FLOW,
          flowSrcPlaceId: 'NEB_1',
          flowDestPlaceId: 'SEA',
        },
      ],
    ],
  },
];
