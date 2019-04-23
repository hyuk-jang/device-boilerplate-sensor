const _ = require('lodash');
const uuidv4 = require('uuid/v4');

const { BU } = require('base-util-jh');

const { dcmConfigModel, dccFlagModel } = require('../../default-intelligence');

const { reqWrapCmdType, requestDeviceControlType } = dcmConfigModel;
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
   * @abstract
   * @param {nodeInfo} nodeInfo
   * @param {string} singleControlType
   */
  convertControlValueToString(nodeInfo, singleControlType) {
    singleControlType = Number(singleControlType);
    let strControlValue = '';
    const onOffList = ['pump'];
    const openCloseList = ['valve', 'waterDoor'];

    let strTrue = '';
    let strFalse = '';

    // Node Class ID를 가져옴. 장치 명에 따라 True, False 개체 명명 변경
    if (_.includes(onOffList, nodeInfo.nc_target_id)) {
      strTrue = 'On';
      strFalse = 'Off';
    } else if (_.includes(openCloseList, nodeInfo.nc_target_id)) {
      strTrue = 'Open';
      strFalse = 'Close';
    }

    switch (singleControlType) {
      case requestDeviceControlType.FALSE:
        strControlValue = strFalse;
        break;
      case requestDeviceControlType.TRUE:
        strControlValue = strTrue;
        break;
      case requestDeviceControlType.MEASURE:
        strControlValue = 'Measure';
        break;
      case requestDeviceControlType.SET:
        strControlValue = 'Set';
        break;
      default:
        break;
    }
    return strControlValue;
  }

  /**
   * @desc 수동 모드에서만 사용 가능
   * 외부에서 단일 명령을 내릴경우
   * @param {reqSingleCmdInfo} reqSingleCmdInfo
   */
  executeSingleControl(reqSingleCmdInfo) {
    // BU.CLI('executeSingleControl');
    process.env.LOG_DBS_EXEC_SC === '1' && BU.CLIN(reqSingleCmdInfo);

    const {
      wrapCmdType = reqWrapCmdType.CONTROL,
      nodeId,
      singleControlType,
      controlSetValue,
      rank = definedCommandSetRank.SECOND,
    } = reqSingleCmdInfo;
    const nodeInfo = _.find(this.nodeList, { node_id: nodeId });

    try {
      // 사용자가 알 수 있는 제어 구문으로 변경
      const cmdName = this.convertControlValueToString(nodeInfo, singleControlType);

      // 설정 제어 값이 존재하고 현재 노드 값과 같다면 추가적으로 제어하지 않음
      if (!_.isNil(controlSetValue) && _.eq(nodeInfo.data, controlSetValue)) {
        throw new Error(
          `${nodeId}: ${controlSetValue} is the same as current value.(${nodeInfo.data}) `,
        );
      }

      // node 현재 값과 동일하다면 제어 요청하지 않음
      if (_.isNil(controlSetValue) && _.eq(nodeInfo.data, cmdName)) {
        throw new Error(`${nodeId}: ${cmdName} is the same as current value.(${nodeInfo.data}) `);
      }

      /** @type {reqCmdEleInfo} 단일 제어 구문을 wrapCmd Ele 요소로 정의 */
      const reqCmdEle = { nodeId, singleControlType, controlSetValue, rank };
      /** @type {reqComplexCmdInfo} 복합 명령으로 정의 */
      const reqComplexCmd = {
        wrapCmdId: `${nodeId}_${cmdName}`,
        wrapCmdName: `${nodeInfo.node_name} ${cmdName}`,
        wrapCmdType,
        reqCmdEleList: [reqCmdEle],
      };

      // TODO:  ICCS에 wrapCmdId를 가진 명령이 존재하는 체크. 있다면 이미 등록된 명령 처리

      // FIXME: 현재 상태와 반대 명령이 ICCS에 등록되어 있을 경우 삭제할 지 여부 개별 구현??

      return this.executeComplexCommand(reqComplexCmd);
    } catch (error) {
      BU.errorLog('excuteControl', 'Error', error);
      throw error;
    }
  }

  /**
   * 저장된 명령 요청 수행
   * @param {wsExecCommandInfo} savedCommandInfo 저장된 명령 ID
   */
  executeSavedCommand(savedCommandInfo) {
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
        singleControlType: requestDeviceControlType.TRUE,
        nodeId: trueList,
        rank: definedCommandSetRank.SECOND,
      });
    }

    // 장치 False 요청
    if (falseList.length) {
      reqComplexCmd.reqCmdEleList.push({
        singleControlType: requestDeviceControlType.FALSE,
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
        singleControlType: requestDeviceControlType.FALSE,
        nodeId: _.reverse(trueList),
        rank: definedCommandSetRank.SECOND,
      });
    }

    // FIXME: 명령 취소에 대한 논리 정립이 안되어 있어 다시 동작 시키는 명령은 비활성
    // 장치 True 요청
    // if (falseList.length) {
    //   reqComplexCmd.reqCmdEleList.push({
    //     singleControlType: requestDeviceControlType.TRUE,
    //     nodeId: _.reverse(falseList),
    //     rank: 2,
    //   });
    // }

    return this.executeComplexCommand(reqComplexCmd);
  }

  /**
   * 최종적으로 명령 생성 및 실행 요청
   * @param {reqComplexCmdInfo} reqComplexCmd
   * @return {boolean} 명령 요청 여부
   */
  executeComplexCommand(reqComplexCmd) {
    // BU.CLI(reqComplexCmd);
    process.env.LOG_DBS_EXEC_CO_HEADER === '1' && BU.CLI('execCombineOrder', reqComplexCmd);

    // 복합 명령을 해체하여 정의
    const {
      wrapCmdId,
      wrapCmdType = reqWrapCmdType.MEASURE,
      wrapCmdName,
      reqCmdEleList,
    } = reqComplexCmd;

    /** @type {complexCmdWrapInfo} */
    const wrapCmdInfo = {
      wrapCmdUUID: uuidv4(),
      wrapCmdId,
      wrapCmdType,
      wrapCmdName,
      containerCmdList: [],
    };

    // 요청 복합 명령 객체의 요청 리스트를 순회하면서 complexCmdContainerInfo 객체를 만들고 삽입
    reqCmdEleList.forEach(reqCmdEleInfo => {
      const {
        nodeId,
        singleControlType = requestDeviceControlType.MEASURE,
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
      let foundRemainInfo = _.find(wrapCmdInfo.containerCmdList, findWhere);

      // 없다면 생성
      if (!foundRemainInfo) {
        foundRemainInfo = {
          singleControlType,
          controlSetValue,
          eleCmdList: [],
        };
        wrapCmdInfo.containerCmdList.push(foundRemainInfo);
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

          foundRemainInfo.eleCmdList.push(elementInfo);
        }
      });
    });

    process.env.LOG_DBS_EXEC_CO_TAIL === '1' && BU.CLIN(wrapCmdInfo, 2);

    // 복합 명령 저장
    const hasSaved = this.model.saveComplexCmd(wrapCmdInfo);
    // const hasSaved = this.model.saveComplexCmd(reqComplexCmd.wrapCmdType, wrapCmdInfo);

    // 복합 명령 실행 요청
    // FIXME: 장치와의 연결이 해제되었더라도 일단 명령 요청을 함. 연결이 해제되면 아에 명령 요청을 거부할지. 어떻게 해야할지 고민 필요
    this.executeCommandToDLC(wrapCmdInfo);

    return hasSaved;
  }

  /**
   * Data Logger Controller로 실제로 명령을 요청하는 메소드
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @memberof Control
   */
  executeCommandToDLC(complexCmdWrapInfo) {
    // BU.CLI(complexCmdWrapInfo)
    process.env.LOG_DBS_TRANS_ORDER === '1' && BU.CLI('transferRequestOr', complexCmdWrapInfo);

    const { wrapCmdUUID, wrapCmdId, wrapCmdName, wrapCmdType } = complexCmdWrapInfo;

    // 아직 요청 전이므로 containerCmdList 순회하면서 명령 생성 및 요청
    complexCmdWrapInfo.containerCmdList.forEach(complexCmdContainerInfo => {
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

    // 명령 요청
    const hasTransferInquiryStatus = this.executeComplexCommand(reqComplexCmd);

    // BU.CLI(hasTransferInquiryStatus);

    // 장치와의 접속이 이루어지지 않을 경우 명령 전송하지 않음
    if (!hasTransferInquiryStatus) {
      BU.log(`${this.makeCommentMainUUID()} Empty Order inquiryAllDeviceStatus`);
      return false;
    }

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
