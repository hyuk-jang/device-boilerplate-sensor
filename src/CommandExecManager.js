const _ = require('lodash');

const { BU } = require('base-util-jh');

const {
  dcmConfigModel: {
    reqWrapCmdType: reqWCT,
    reqWrapCmdFormat: reqWCF,
    reqDeviceControlType: reqDCT,
  },
  dccFlagModel: { definedCommandSetRank },
} = require('../../default-intelligence');

class CommandExecManager {
  /**
   * Creates an instance of Model.
   * @param {MainControl} controller
   */
  constructor(controller) {
    this.controller = controller;

    const { coreFacade, model, nodeList, dataLoggerList, mainUUID } = controller;
    // Command Execute Manager 를 Core Facde에 정의
    coreFacade.setCmdExecManager(this);

    this.coreFacade = coreFacade;
    this.model = model;
    this.nodeList = nodeList;
    this.dataLoggerList = dataLoggerList;
    this.mainUUID = mainUUID;
  }

  /**
   * 계측 명령
   * @param {reqMeasureCmdInfo} reqMeasureCmdInfo
   */
  executeMeasure(reqMeasureCmdInfo) {
    // BU.CLI(reqMeasureCmdInfo);
    const {
      wrapCmdType = reqWCT.CONTROL,
      wrapCmdId,
      wrapCmdName,
      searchIdList,
      rank,
    } = reqMeasureCmdInfo;

    /** @type {reqCommandInfo} 명령 실행 설정 객체 */
    const reqCommandOption = {
      wrapCmdFormat: reqWCF.MEASURE,
      wrapCmdType,
      wrapCmdId,
      wrapCmdName,
      rank,
      reqCmdEleList: [
        {
          singleControlType: reqDCT.MEASURE,
          searchIdList,
          rank,
        },
      ],
    };

    try {
      return this.executeCommand(reqCommandOption);
    } catch (error) {
      throw error;
    }
  }

  /**
   * @desc 수동 모드에서만 사용 가능
   * 외부에서 단일 명령을 내릴경우
   * @param {reqSingleCmdInfo} reqSingleCmdInfo
   */
  executeSingleControl(reqSingleCmdInfo) {
    // BU.CLI('executeSingleControl', reqSingleCmdInfo);
    process.env.LOG_DBS_EXEC_SC === '1' && BU.CLIN(reqSingleCmdInfo);

    const {
      wrapCmdType = reqWCT.CONTROL,
      nodeId,
      singleControlType,
      controlSetValue,
      rank = definedCommandSetRank.SECOND,
      wrapCmdGoalInfo,
    } = reqSingleCmdInfo;

    // 제어하고자 하는 노드 정보를 가져옴

    try {
      // 다중 배열 Node 가 들어올 경우
      if (_.isArray(nodeId)) {
        // 사용자가 알 수 있는 제어 구문으로 변경

        /** @type {reqCommandInfo} 명령 실행 설정 객체 */
        const reqCommandOption = {
          wrapCmdFormat: reqWCF.SINGLE,
          wrapCmdType,
          wrapCmdId: `${nodeId.toString()}_${singleControlType}`,
          wrapCmdName: `${nodeId.toString()}_${singleControlType}`,
          reqCmdEleList: [
            {
              singleControlType,
              searchIdList: nodeId,
            },
          ],
          wrapCmdGoalInfo,
          rank,
        };
        return this.executeCommand(reqCommandOption);
      }
      const nodeInfo = _.find(this.nodeList, { node_id: nodeId });

      // 사용자가 알 수 있는 제어 구문으로 변경
      const cmdName = this.coreFacade.cmdManager.convertControlValueToString(
        nodeInfo,
        singleControlType,
      );

      /** @type {reqCommandInfo} 명령 실행 설정 객체 */
      const reqCommandOption = {
        wrapCmdFormat: reqWCF.SINGLE,
        wrapCmdType,
        wrapCmdId: `${nodeId}_${cmdName}${_.isEmpty(controlSetValue) ? '' : `_${controlSetValue}`}`,
        wrapCmdName: `${nodeInfo.node_name} ${cmdName}`,
        reqCmdEleList: [
          {
            singleControlType,
            searchIdList: [nodeId],
          },
        ],
        wrapCmdGoalInfo,
        rank,
      };
      return this.executeCommand(reqCommandOption);
    } catch (error) {
      BU.errorLog('excuteControl', 'Error', error);
      throw error;
    }
  }

  /**
   * 설정 명령 요청 수행
   * @param {reqSetCmdInfo} reqSetCmdInfo 저장된 명령 ID
   */
  executeSetControl(reqSetCmdInfo) {
    // BU.CLI(reqSetCmdInfo);
    try {
      const {
        wrapCmdId,
        wrapCmdType = reqWCT.CONTROL,
        rank = definedCommandSetRank.SECOND,
        wrapCmdGoalInfo,
      } = reqSetCmdInfo;

      // 설정 명령 조회
      const setCmdInfo = this.model.findSetCommand(wrapCmdId);
      // 세부 흐름 명령이 존재하지 않을 경우
      if (_.isEmpty(setCmdInfo)) {
        throw new Error(`set command: ${wrapCmdId} not found`);
      }

      /** @type {reqCommandInfo} 명령 실행 설정 객체 */
      const reqCommandOption = {
        wrapCmdFormat: reqWCF.SET,
        wrapCmdType,
        wrapCmdId,
        wrapCmdName: setCmdInfo.cmdName,
        reqCmdEleList: this.makeControlEleCmdList(setCmdInfo, rank),
        wrapCmdGoalInfo,
        rank,
      };

      return this.executeCommand(reqCommandOption);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 흐름 명령을 요청할 경우
   * @param {reqFlowCmdInfo} reqFlowCmdInfo
   */
  executeFlowControl(reqFlowCmdInfo) {
    try {
      const {
        srcPlaceId,
        destPlaceId,
        wrapCmdType = reqWCT.CONTROL,
        wrapCmdGoalInfo,
        rank = definedCommandSetRank.SECOND,
      } = reqFlowCmdInfo;

      // BU.CLI(reqFlowCmdInfo)

      // 세부 명령 흐름 조회
      const flowCmdDestInfo = this.model.findFlowCommand(reqFlowCmdInfo);
      // 세부 흐름 명령이 존재하지 않을 경우
      if (_.isEmpty(flowCmdDestInfo)) {
        BU.CLI(`The flow command: ${srcPlaceId}_TO_${destPlaceId} not found`);
        throw new Error(`The flow command: ${srcPlaceId}_TO_${destPlaceId} not found`);
      }

      /** @type {reqCommandInfo} 명령 실행 설정 객체 */
      const reqCommandOption = {
        wrapCmdFormat: reqWCF.FLOW,
        wrapCmdType,
        wrapCmdId: flowCmdDestInfo.cmdId,
        wrapCmdName: flowCmdDestInfo.cmdName,
        srcPlaceId,
        destPlaceId,
        reqCmdEleList: this.makeControlEleCmdList(flowCmdDestInfo, rank),
        wrapCmdGoalInfo,
        rank,
      };

      return this.executeCommand(reqCommandOption);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 시나리오를 수행하고자 할 경우
   * @param {reqScenarioCmdInfo} reqScenarioCmdInfo 시나리오 명령 정보
   */
  executeScenarioControl(reqScenarioCmdInfo) {
    // BU.CLI(reqSetCmdInfo);
    try {
      const {
        wrapCmdId,
        wrapCmdType = reqWCT.CONTROL,
        rank = definedCommandSetRank.SECOND,
      } = reqScenarioCmdInfo;

      const scenarioCmdInfo = this.model.findScenarioCommand(wrapCmdId);
      // BU.CLIN(scenarioCmdInfo);
      // 세부 흐름 명령이 존재하지 않을 경우
      if (_.isEmpty(scenarioCmdInfo)) {
        throw new Error(`scenario command: ${wrapCmdId} not found`);
      }

      /** @type {reqCommandInfo} 명령 실행 설정 객체 */
      const reqCommandOption = {
        wrapCmdFormat: reqWCF.SCENARIO,
        wrapCmdId,
        rank,
      };

      return this.model.scenarioManager.initScenario(reqCommandOption);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 흐름 명령을 세부 제어 목록 반환
   * @param {flowCmdDestInfo} flowCmdDestInfo
   * @param {number} rank
   */
  makeControlEleCmdList(flowCmdDestInfo, rank) {
    /** @type {reqCmdEleInfo[]} */
    const reqCmdEleList = [];
    const { trueNodeList, falseNodeList } = flowCmdDestInfo;
    if (trueNodeList.length) {
      reqCmdEleList.push({
        singleControlType: reqDCT.TRUE,
        nodeId: trueNodeList,
        searchIdList: trueNodeList,
        rank,
      });
    }

    // 장치 False 요청
    if (falseNodeList.length) {
      reqCmdEleList.push({
        singleControlType: reqDCT.FALSE,
        nodeId: falseNodeList,
        searchIdList: falseNodeList,
        rank,
      });
    }
    return reqCmdEleList;
  }

  /**
   * 최종적으로 명령 생성 및 실행 요청
   * @param {reqCommandInfo} reqCommandInfo
   */
  executeCommand(reqCommandInfo) {
    // BU.CLI(reqCommandInfo.wrapCmdId);
    try {
      const { wrapCmdFormat, reqCmdEleList } = reqCommandInfo;

      // BU.CLIN(reqCmdEleList);

      reqCmdEleList.forEach(reqCmdEleInfo => {
        const { searchIdList } = reqCmdEleInfo;
        reqCmdEleInfo.searchIdList = _.reject(searchIdList, searchId => {
          const dlc = this.model.findDataLoggerController(searchId);
          let errMsg = '';
          if (_.isUndefined(dlc)) {
            errMsg = `DLC: ${searchId}가 존재하지 않습니다.`;
            // BU.CLI(errMsg);
          } else if (!_.get(dlc, 'hasConnectedDevice')) {
            errMsg = `${searchId}는 장치와 연결되지 않았습니다.`;
            // BU.CLI(errMsg);
          }

          return errMsg.length;

          // // 계측 명령 내릴 때 에러가 있을 경우
          // if(errMsg.length) {
          //   // 계측 명령이
          //   return true;
          // }
        });
      });

      // BU.CLIN(reqCmdEleList);

      return this.coreFacade.cmdManager.executeCommand(reqCommandInfo);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 정기적인 Router Status 탐색
   */
  inquiryAllDeviceStatus() {
    // BU.CLI('inquiryAllDeviceStatus', this.controller.mainUUID);
    process.env.LOG_DBS_INQUIRY_START === '1' &&
      BU.CLI(`${this.makeCommentMainUUID()} Start inquiryAllDeviceStatus`);
    try {
      /** @type {reqMeasureCmdInfo} */
      const reqMeasureCmdOption = {
        wrapCmdId: 'inquiryAllDeviceStatus',
        wrapCmdName: '정기 장치 상태 계측',
        searchIdList: _.map(this.dataLoggerList, 'dl_id'),
      };

      // BU.CLI(reqMeasureCmdOption);

      return this.executeMeasure(reqMeasureCmdOption);
    } catch (error) {
      throw error;
    }
  }

  /** MainUUID 가 존재할 경우 해당 지점을 알리기 위한 텍스트 생성 */
  makeCommentMainUUID() {
    if (this.mainUUID.length) {
      return `MainUUID: ${this.mainUUID}`;
    }
    return '';
  }
}
module.exports = CommandExecManager;
