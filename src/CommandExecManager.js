const _ = require('lodash');
const uuidv4 = require('uuid/v4');

const { BU } = require('base-util-jh');

const { dcmConfigModel, dccFlagModel } = require('../../default-intelligence');

const { controlModeInfo, reqWrapCmdType, reqWrapCmdFormat, reqDeviceControlType } = dcmConfigModel;
const { definedCommandSetRank } = dccFlagModel;

const ControlDBS = require('./Control');

class CommandExecManager {
  /**
   * Creates an instance of Model.
   * @param {ControlDBS} controller
   */
  constructor(controller) {
    this.controller = controller;

    const { model, nodeList, dataLoggerList, mainUUID } = controller;

    this.model = model;
    this.nodeList = nodeList;
    this.dataLoggerList = dataLoggerList;
    this.mainUUID = mainUUID;
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
      wrapCmdType = reqWrapCmdType.CONTROL,
      nodeId,
      singleControlType,
      controlSetValue,
      rank = definedCommandSetRank.SECOND,
    } = reqSingleCmdInfo;
    // 제어하고자 하는 노드 정보를 가져옴
    const nodeInfo = _.find(this.nodeList, { node_id: nodeId });

    try {
      // 사용자가 알 수 있는 제어 구문으로 변경
      const cmdName = this.model.convertControlValueToString(nodeInfo, singleControlType);

      // 설정 제어 값이 존재하고 현재 노드 값과 같다면 추가적으로 제어하지 않음
      if (!_.isNil(controlSetValue) && _.eq(nodeInfo.data, controlSetValue)) {
        throw new Error(
          `${nodeId}: ${controlSetValue} is the same as current value.(${nodeInfo.data}) `,
        );
      }

      // node 현재 값과 동일하다면 제어 요청하지 않음
      if (_.isNil(controlSetValue) && _.eq(_.lowerCase(nodeInfo.data), _.lowerCase(cmdName))) {
        throw new Error(`${nodeId}: ${cmdName} is the same as current value.(${nodeInfo.data}) `);
      }

      /** @type {reqCmdEleInfo} 단일 제어 구문을 wrapCmd Ele 요소로 정의 */
      const reqCmdEle = { nodeId, singleControlType, controlSetValue, rank };
      /** @type {reqComplexCmdInfo} 복합 명령으로 정의 */
      const reqComplexCmd = {
        wrapCmdId: `${nodeId}_${cmdName}${_.isEmpty(controlSetValue) ? '' : `_${controlSetValue}`}`,
        wrapCmdName: `${nodeInfo.node_name} ${cmdName}`,
        wrapCmdType,
        wrapCmdFormat: reqWrapCmdFormat.SINGLE,
        reqCmdEleList: [reqCmdEle],
      };

      // overlapControlStorageList에 해당 노드에 대한 명령이 등록되어 있다면 요청하지 않음.
      const isExistSingleControl = this.model.isExistSingleControl({
        nodeId,
        singleControlType,
        controlSetValue,
      });

      if (isExistSingleControl) {
        throw new Error(`wrapCmdId: ${reqComplexCmd.wrapCmdId} is exist`);
      }

      return this.executeComplexCommand(reqComplexCmd);
    } catch (error) {
      BU.errorLog('excuteControl', 'Error', error);
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
        wrapCmdType,
        wrapCmdGoalInfo,
        rank = definedCommandSetRank.SECOND,
      } = reqFlowCmdInfo;

      // 세부 명령 흐름 조회
      const flowCmdDestInfo = this.model.findFlowCommand(reqFlowCmdInfo);
      // 세부 흐름 명령이 존재하지 않을 경우
      if (_.isEmpty(flowCmdDestInfo)) {
        throw new Error(`flow command: ${srcPlaceId}_TO_${destPlaceId} not found`);
      }

      // 실제 WrapCmdId와 wrapCmdName을 가져옴
      const { cmdId: wrapCmdId, cmdName } = flowCmdDestInfo;

      /** @type {reqComplexCmdInfo} */
      const reqComplexCmd = {
        wrapCmdId,
        wrapCmdName: cmdName,
        wrapCmdType,
        wrapCmdFormat: reqWrapCmdFormat.FLOW,
        srcPlaceId,
        destPlaceId,
        wrapCmdGoalInfo,
        reqCmdEleList: this.makeControlEleCmdList(flowCmdDestInfo, rank),
      };

      // 명령을 요청할 경우
      // if (_.eq(wrapCmdType, reqWrapCmdType.CONTROL)) {
      //   reqComplexCmd.reqCmdEleList = this.makeControlEleCmdList(flowCmdDestInfo, rank);
      // } else
      if (_.eq(wrapCmdType, reqWrapCmdType.CANCEL)) {
        // wrapCmdId를 가진 복합 명령 개체가 있는지 확인
        const compelxCmdInfo = _.find(this.model.complexCmdList, {
          wrapCmdId,
          wrapCmdType: reqWrapCmdType.CONTROL,
        });
        // 명령이 실행중이지 않는다면 복원 명령을 내릴 수 없음.
        if (_.isEmpty(compelxCmdInfo)) {
          throw new Error(
            `The command(${wrapCmdId}) does not exist and you can not issue a CANCEL command.`,
          );
        }

        // if (_.eq(compelxCmdInfo.wrapCmdStep, complexCmdStep.RUNNING)) {
        //   throw new Error('The type of command being executed is not a CONTROL request.');
        // }

        // reqComplexCmd.reqCmdEleList = this.makeRestoreEleCmdList(flowCmdDestInfo, rank);
      }

      // BU.CLI(reqComplexCmd);
      return this.executeComplexCommand(reqComplexCmd);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 설정 명령 요청 수행
   * @param {wsExecCmdInfo} reqSetCmdInfo 저장된 명령 ID
   */
  executeSetControl(reqSetCmdInfo) {
    // BU.CLI(reqSetCmdInfo);
    try {
      const { wrapCmdId, wrapCmdType, rank = definedCommandSetRank.SECOND } = reqSetCmdInfo;

      // 설정 명령 조회
      const setCmdInfo = _.find(this.model.mapCmdInfo.setCmdList, { cmdId: wrapCmdId });
      // BU.CLI(setCmdInfo);

      if (setCmdInfo) {
        /** @type {reqComplexCmdInfo} */
        const reqComplexCmd = {
          wrapCmdId,
          wrapCmdName: '',
          wrapCmdType,
          wrapCmdFormat: reqWrapCmdFormat.SET,
          reqCmdEleList: [],
        };

        // 명령을 요청할 경우
        if (_.eq(wrapCmdType, reqWrapCmdType.CONTROL)) {
          reqComplexCmd.reqCmdEleList = this.makeControlEleCmdList(setCmdInfo, rank);
        } else if (_.eq(wrapCmdType, reqWrapCmdType.RESTORE)) {
          // wrapCmdId를 가진 복합 명령 개체가 있는지 확인
          const compelxCmdInfo = _.find(this.model.complexCmdList, { wrapCmdId });
          // 명령이 실행중이지 않는다면 복원 명령을 내릴 수 없음.
          if (_.isEmpty(compelxCmdInfo)) {
            throw new Error(
              `The command(${wrapCmdId}) does not exist and you can not issue a restore command.`,
            );
          }

          // 제어 요청 명령일 경우에만 복원 가능
          if (_.eq(compelxCmdInfo.wrapCmdType, reqWrapCmdType.CONTROL)) {
            throw new Error('The type of command being executed is not a CONTROL request.');
          }

          // if (_.eq(compelxCmdInfo.wrapCmdStep, complexCmdStep.RUNNING)) {
          //   throw new Error('The type of command being executed is not a CONTROL request.');
          // }

          reqComplexCmd.reqCmdEleList = this.makeRestoreEleCmdList(setCmdInfo, rank);
        }

        return this.executeComplexCommand(reqComplexCmd);
      }
      throw new Error(`wrapCmdId: ${wrapCmdId} does not exist.`);
    } catch (error) {
      // 수동모드에서 설정 명령을 발송할 경우 예외는 무시
      // if (this.controller.controlMode === controlModeInfo.MANUAL) {
      //   return false;
      // }
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
        singleControlType: reqDeviceControlType.TRUE,
        nodeId: trueNodeList,
        rank,
      });
    }

    // 장치 False 요청
    if (falseNodeList.length) {
      reqCmdEleList.push({
        singleControlType: reqDeviceControlType.FALSE,
        nodeId: falseNodeList,
        rank,
      });
    }
    return reqCmdEleList;
  }

  /**
   * 복원 명령을 세부 제어 목록 반환
   * @param {flowCmdDestInfo} flowCmdDestInfo
   * @param {number} rank
   */
  makeRestoreEleCmdList(flowCmdDestInfo, rank) {
    /** @type {reqCmdEleInfo[]} */
    const reqCmdEleList = [];
    const { trueNodeList, falseNodeList } = flowCmdDestInfo;
    if (trueNodeList.length) {
      reqCmdEleList.push({
        singleControlType: reqDeviceControlType.FALSE,
        nodeId: _.reverse(trueNodeList),
        rank,
      });
    }

    // 장치 False 요청
    if (falseNodeList.length) {
      reqCmdEleList.push({
        singleControlType: reqDeviceControlType.TRUE,
        nodeId: _.reverse(falseNodeList),
        rank,
      });
    }
    return reqCmdEleList;
  }

  /**
   * 저장된 명령 요청 수행
   * @param {wsExecCommandInfo} savedCommandInfo 저장된 명령 ID
   */
  executeSavedCommand(savedCommandInfo) {
    // BU.CLI(savedCommandInfo);
    try {
      const { savedCommandId, wrapCmdType } = savedCommandInfo;
      const foundIt = _.find(this.model.excuteControlList, { cmdName: savedCommandId });
      if (foundIt) {
        const { trueList = [], falseList = [] } = foundIt;
        // 명령 제어 요청 일 경우
        if (wrapCmdType === reqWrapCmdType.CONTROL) {
          return this.executeAutomaticControl({
            cmdName: savedCommandId,
            trueList,
            falseList,
          });
        }
        if (wrapCmdType === reqWrapCmdType.CANCEL) {
          // 명령 취소 일 경우
          return this.cancelAutomaticControl({
            cmdName: savedCommandId,
            trueList,
            falseList,
          });
        }
        throw new Error(`commandType: ${wrapCmdType} can not be identified. `);
      }
      throw new Error(`commandId: ${savedCommandId} does not exist.`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 자동 명령 요청
   * @param {{cmdName: string, trueList: string[], falseList: string[]}} controlInfo
   */
  executeAutomaticControl(controlInfo) {
    process.env.LOG_DBS_EXEC_AC === '1' && BU.CLI(controlInfo);

    const { cmdName, trueList = [], falseList = [] } = controlInfo;

    /** @type {reqComplexCmdInfo} */
    const reqComplexCmd = {
      wrapCmdId: cmdName,
      wrapCmdName: `${cmdName} ${reqWrapCmdType.CONTROL}`,
      wrapCmdType: reqWrapCmdType.CONTROL,
      reqCmdEleList: [],
    };

    // 장치 True 요청
    if (trueList.length) {
      reqComplexCmd.reqCmdEleList.push({
        singleControlType: reqDeviceControlType.TRUE,
        nodeId: trueList,
        rank: definedCommandSetRank.SECOND,
      });
    }

    // 장치 False 요청
    if (falseList.length) {
      reqComplexCmd.reqCmdEleList.push({
        singleControlType: reqDeviceControlType.FALSE,
        nodeId: falseList,
        rank: definedCommandSetRank.SECOND,
      });
    }

    return this.executeComplexCommand(reqComplexCmd);
  }

  /**
   * 명령 취소 요청
   * @param {{cmdName: string, trueList: string[], falseList: string[]}} controlInfo
   */
  cancelAutomaticControl(controlInfo) {
    process.env.LOG_DBS_EXEC_AC === '1' && BU.CLI(controlInfo);

    const { cmdName, trueList = [], falseList = [] } = controlInfo;
    /** @type {reqComplexCmdInfo} */
    const reqComplexCmd = {
      wrapCmdId: cmdName,
      wrapCmdName: `${cmdName} ${reqWrapCmdType.CANCEL}`,
      wrapCmdType: reqWrapCmdType.CANCEL,
      reqCmdEleList: [],
    };

    // 장치 False 요청 (켜져 있는 장치만 끔)
    if (trueList.length) {
      reqComplexCmd.reqCmdEleList.push({
        singleControlType: reqDeviceControlType.FALSE,
        nodeId: _.reverse(trueList),
        rank: definedCommandSetRank.SECOND,
      });
    }

    // FIXME: 명령 취소에 대한 논리 정립이 안되어 있어 다시 동작 시키는 명령은 비활성
    // 장치 True 요청
    // if (falseList.length) {
    //   reqComplexCmd.reqCmdEleList.push({
    //     singleControlType: reqDeviceControlType.TRUE,
    //     nodeId: _.reverse(falseList),
    //     rank: 2,
    //   });
    // }

    return this.executeComplexCommand(reqComplexCmd);
  }

  /**
   * 최종적으로 명령 생성 및 실행 요청
   * @param {reqComplexCmdInfo} reqComplexCmd
   * @return {complexCmdWrapInfo} 명령 요청 여부
   */
  executeComplexCommand(reqComplexCmd) {
    // BU.CLI(reqComplexCmd);
    try {
      process.env.LOG_DBS_EXEC_CO_HEADER === '1' && BU.CLI('executeComplexCommand', reqComplexCmd);

      // 복합 명령을 해체하여 정의
      const {
        wrapCmdId,
        wrapCmdType = reqWrapCmdType.MEASURE,
        wrapCmdName,
        wrapCmdFormat,
        srcPlaceId,
        destPlaceId,
        wrapCmdGoalInfo,
        reqCmdEleList,
      } = reqComplexCmd;

      // BU.CLI(reqCmdEleList);

      /** @type {complexCmdWrapInfo} */
      const wrapCmdInfo = {
        wrapCmdUUID: uuidv4(),
        wrapCmdId,
        wrapCmdType,
        wrapCmdName,
        wrapCmdFormat,
        srcPlaceId,
        destPlaceId,
        wrapCmdGoalInfo,
        containerCmdList: [],
        realContainerCmdList: [],
      };

      // 취소 명령을 요청할 경우 기존 실행 중인 명령이 없다면 예외 발생
      if (wrapCmdType === reqWrapCmdType.CANCEL) {
        const prceedWrapCmdInfo = this.model.cmdManager.getComplexCommand(wrapCmdId);
        if (_.isEmpty(prceedWrapCmdInfo)) {
          throw new Error(
            `The command(${wrapCmdId}) does not exist and you can not issue a CANCEL command.`,
          );
        }
        wrapCmdInfo.wrapCmdUUID = prceedWrapCmdInfo.wrapCmdUUID;
      }

      // 요청 복합 명령 객체의 요청 리스트를 순회하면서 complexCmdContainerInfo 객체를 만들고 삽입
      reqCmdEleList.forEach(reqCmdEleInfo => {
        const {
          nodeId,
          singleControlType = reqDeviceControlType.MEASURE,
          controlSetValue,
          rank = definedCommandSetRank.THIRD,
        } = reqCmdEleInfo;
        // nodeId가 string이라면 배열생성 후 집어넣음
        const nodeList = _.isArray(nodeId) ? nodeId : [nodeId];

        // 설정 값(controlSetValue)가 존재한다면 해당 값 AND 조건 추가 탐색
        const findWhere = _.isEmpty(controlSetValue)
          ? { singleControlType }
          : { singleControlType, controlSetValue };

        // 해당 singleControlType가 eleCmdList 기존재하는지 체크
        let foundContainerCmdInfo = _.find(wrapCmdInfo.containerCmdList, findWhere);

        // 없다면 생성
        if (!foundContainerCmdInfo) {
          foundContainerCmdInfo = {
            singleControlType,
            controlSetValue,
            eleCmdList: [],
          };
          wrapCmdInfo.containerCmdList.push(foundContainerCmdInfo);
        }

        // 배열을 반복하면서 element를 생성 후 remainInfo에 삽입
        _.forEach(nodeList, currNodeId => {
          // BU.CLI(currNodeId);
          // 장치와 연결되어 있는 DLC 불러옴
          const dataLoggerController = this.model.findDataLoggerController(currNodeId);
          // 해당하는 DLC가 없거나 장치가 비접속이라면 명령을 수행하지 않음
          // TODO: reqComplexCmd의 실행 가능 여부를 판단하고 명령에서 제외하는 것이 맞는지 검증 필요
          let errMsg = '';
          if (_.isUndefined(dataLoggerController)) {
            errMsg = `DLC: ${currNodeId}가 존재하지 않습니다.`;
            // BU.CLI(errMsg);
          } else if (!_.get(dataLoggerController, 'hasConnectedDevice')) {
            errMsg = `${currNodeId}는 장치와 연결되지 않았습니다.`;
            // BU.CLI(errMsg);
          }
          if (errMsg.length) {
            // BU.CLI(errMsg);
            // BU.errorLog(
            //   'executeComplexCmd',
            //   `mainUUID: ${
            //     this.mainUUID
            //   } nodeId: ${currNodeId} singleControlType: ${singleControlType} msg: ${errMsg}`,
            // );
          } else {
            /** @type {complexCmdEleInfo} */
            const elementInfo = {
              hasComplete: false,
              nodeId: currNodeId,
              rank,
              uuid: uuidv4(),
            };

            foundContainerCmdInfo.eleCmdList.push(elementInfo);
          }
        });
      });

      process.env.LOG_DBS_EXEC_CO_TAIL === '1' && BU.CLIN(wrapCmdInfo, 2);

      // 복합 명령 저장
      this.model.saveComplexCommand(wrapCmdInfo);

      // 실제 내릴 명령이 있을 경우에만 요청
      // if (wrapCmdInfo.realContainerCmdList.length) {
      // 복합 명령 실행 요청
      // FIXME: 장치와의 연결이 해제되었더라도 일단 명령 요청을 함. 연결이 해제되면 아에 명령 요청을 거부할지. 어떻게 해야할지 고민 필요
      this.executeCommandToDLC(wrapCmdInfo);
      // }

      // const hasSaved = this.model.saveComplexCmd(reqComplexCmd.wrapCmdType, wrapCmdInfo);

      return wrapCmdInfo;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Data Logger Controller로 실제로 명령을 요청하는 메소드
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @memberof Control
   */
  executeCommandToDLC(complexCmdWrapInfo) {
    // BU.CLI(complexCmdWrapInfo);
    process.env.LOG_DBS_TRANS_ORDER === '1' && BU.CLI('transferRequestOr', complexCmdWrapInfo);

    const { wrapCmdUUID, wrapCmdId, wrapCmdName, wrapCmdType } = complexCmdWrapInfo;

    // 아직 요청 전이므로 realContainerCmdList 순회하면서 명령 생성 및 요청
    complexCmdWrapInfo.realContainerCmdList.forEach(complexCmdContainerInfo => {
      const { singleControlType, controlSetValue } = complexCmdContainerInfo;

      // const hasFirst = true;
      complexCmdContainerInfo.eleCmdList.forEach(complexCmdEleInfo => {
        const { nodeId, rank, uuid } = complexCmdEleInfo;
        // if (hasFirst) {
        /** @type {executeCmdInfo} */
        const executeCmd = {
          wrapCmdUUID,
          wrapCmdId,
          wrapCmdName,
          wrapCmdType,
          singleControlType,
          controlSetValue,
          nodeId,
          rank,
          uuid,
        };

        const dataLoggerController = this.model.findDataLoggerController(nodeId);

        dataLoggerController.requestCommand(executeCmd);
        // hasFirst = false;
        // }
      });
    });
  }

  /**
   * 정기적인 Router Status 탐색
   */
  inquiryAllDeviceStatus() {
    BU.CLI('inquiryAllDeviceStatus');
    process.env.LOG_DBS_INQUIRY_START === '1' &&
      BU.CLI(`${this.makeCommentMainUUID()} Start inquiryAllDeviceStatus`);

    /** @type {reqComplexCmdInfo} */
    const reqComplexCmd = {
      wrapCmdId: 'inquiryAllDeviceStatus',
      wrapCmdName: '정기 장치 상태 계측',
      wrapCmdType: reqWrapCmdType.MEASURE,
      reqCmdEleList: [{ nodeId: _.map(this.dataLoggerList, 'dl_id') }],
    };

    // BU.CLI(_.map(this.dataLoggerList, 'dl_id'));
    // BU.CLI(reqComplexCmd);

    try {
      const { realContainerCmdList } = this.executeComplexCommand(reqComplexCmd);

      if (
        !_(realContainerCmdList)
          .map('eleCmdList')
          .flatten()
          .value().length
      ) {
        // BU.log(`${this.makeCommentMainUUID()} Empty Order inquiryAllDeviceStatus`);
        BU.CLI(`${this.makeCommentMainUUID()} Empty Order inquiryAllDeviceStatus`);
        return false;
      }
      return true;
    } catch (error) {
      // return false;
      throw error;
    }

    // 명령 요청

    // BU.CLI(hasTransferInquiryStatus);

    // 장치와의 접속이 이루어지지 않을 경우 명령 전송하지 않음
    // if (!hasTransferInquiryStatus) {
    //   BU.log(`${this.makeCommentMainUUID()} Empty Order inquiryAllDeviceStatus`);
    //   // BU.CLI(`${this.makeCommentMainUUID()} Empty Order inquiryAllDeviceStatus`);
    //   return false;
    // }

    // Data Logger 현재 상태 조회
    // this.dataLoggerControllerList.forEach(router => {
    //   /** @type {reqExecCmdInfo} */
    //   let ruquestOrder = {};
    //   ruquestOrder.nodeId = 'DEFAULT';
    //   ruquestOrder.wrapCmdType = 'ADD';
    //   ruquestOrder.wrapCmdId = 'regularDiscovery';

    //   router.orderOperationDefault(ruquestOrder);
    // });
  }

  /** 인증이 되었음을 알림 */
  // nofityAuthentication() {
  //   BU.CLI('nofityAuthentication');
  //   // 현황판 데이터 요청
  //   this.emit('nofityAuthentication');
  // }

  /** MainUUID 가 존재할 경우 해당 지점을 알리기 위한 텍스트 생성 */
  makeCommentMainUUID() {
    if (this.mainUUID.length) {
      return `MainUUID: ${this.mainUUID}`;
    }
    return '';
  }
}
module.exports = CommandExecManager;
