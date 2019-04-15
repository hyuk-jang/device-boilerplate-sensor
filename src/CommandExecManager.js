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
   * @param {string} controlValue
   */
  convertControlValueToString(nodeInfo, controlValue) {
    controlValue = Number(controlValue);
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

    switch (controlValue) {
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
   * 외부에서 단일 명령을 내릴경우
   * @param {reqSingleCmdInfo} reqSingleCmdInfo
   */
  executeSingleControl(reqSingleCmdInfo) {
    // BU.CLI('executeSingleControl');
    process.env.LOG_DBS_EXEC_SC === '1' && BU.CLIN(reqSingleCmdInfo);

    const {
      wrapCmdType,
      nodeId,
      controlValue,
      controlSetValue,
      rank = definedCommandSetRank.SECOND,
    } = reqSingleCmdInfo;
    const nodeInfo = _.find(this.nodeList, { node_id: nodeId });
    try {
      /** @type {reqComplexCmdInfo} */
      const reqComplexCmd = {
        wrapCmdId: `S_${nodeId}_${this.convertControlValueToString(nodeInfo, controlValue)}`,
        wrapCmdName: '',
        wrapCmdType,
        reqCmdEleList: [],
      };

      /** @type {reqCmdEleInfo} */
      const reqCmdEle = { nodeId, controlValue, controlSetValue, rank };

      reqComplexCmd.reqCmdEleList.push(reqCmdEle);

      return this.executeComplexCmd(reqComplexCmd);
    } catch (error) {
      BU.errorLog('excuteControl', 'Error', error);
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
        controlValue: requestDeviceControlType.TRUE,
        nodeId: trueList,
        rank: definedCommandSetRank.SECOND,
      });
    }

    // 장치 False 요청
    if (falseList.length) {
      reqComplexCmd.reqCmdEleList.push({
        controlValue: requestDeviceControlType.FALSE,
        nodeId: falseList,
        rank: definedCommandSetRank.SECOND,
      });
    }

    return this.executeComplexCmd(reqComplexCmd);
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
        controlValue: requestDeviceControlType.FALSE,
        nodeId: _.reverse(trueList),
        rank: definedCommandSetRank.SECOND,
      });
    }

    // FIXME: 명령 취소에 대한 논리 정립이 안되어 있어 다시 동작 시키는 명령은 비활성
    // 장치 True 요청
    // if (falseList.length) {
    //   reqComplexCmd.reqCmdEleList.push({
    //     controlValue: requestDeviceControlType.TRUE,
    //     nodeId: _.reverse(falseList),
    //     rank: 2,
    //   });
    // }

    return this.executeComplexCmd(reqComplexCmd);
  }

  /**
   * 저장된 명령 요청 수행
   * @param {{savedCommandId: string, wrapCmdType: string }} savedCommandInfo 저장된 명령 ID
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
   * 복합 명령 실행 요청
   * @param {reqComplexCmdInfo} reqComplexCmd
   * @return {boolean} 명령 요청 여부
   */
  executeComplexCmd(reqComplexCmd) {
    // BU.CLI(reqComplexCmd);
    process.env.LOG_DBS_EXEC_CO_HEADER === '1' && BU.CLI('execCombineOrder', reqComplexCmd);

    // 복합 명령을 해체하여 정의
    const { wrapCmdId, wrapCmdType, wrapCmdName, reqCmdEleList } = reqComplexCmd;

    /** @type {complexCmdWrapInfo} */
    const complexCmdWrap = {
      uuid: uuidv4(),
      wrapCmdId,
      wrapCmdType,
      wrapCmdName,
      complexCmdContainerList: [],
    };

    // 요청 복합 명령 객체의 요청 리스트를 순회하면서 complexCmdContainerInfo 객체를 만들고 삽입
    reqCmdEleList.forEach(reqCmdEleInfo => {
      const {
        nodeId,
        controlValue = requestDeviceControlType.MEASURE,
        controlSetValue,
        rank = definedCommandSetRank.THIRD,
      } = reqCmdEleInfo;
      // nodeId가 string이라면 배열생성 후 집어넣음
      const nodeList = _.isArray(nodeId) ? nodeId : [nodeId];

      // 해당 controlValue가 complexEleList 기존재하는지 체크
      let foundRemainInfo = _.find(complexCmdWrap.complexCmdContainerList, {
        controlValue,
      });
      // 없다면
      if (!foundRemainInfo) {
        foundRemainInfo = {
          controlValue,
          controlSetValue,
          complexEleList: [],
        };
        complexCmdWrap.complexCmdContainerList.push(foundRemainInfo);
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
          //   } nodeId: ${currNodeId} controlValue: ${controlValue} msg: ${errMsg}`,
          // );
        } else {
          /** @type {complexCmdEleInfo} */
          const elementInfo = {
            hasComplete: false,
            nodeId: currNodeId,
            rank,
            uuid: uuidv4(),
          };

          foundRemainInfo.complexEleList.push(elementInfo);
        }
      });
    });

    process.env.LOG_DBS_EXEC_CO_TAIL === '1' && BU.CLIN(complexCmdWrap, 2);

    // 복합 명령 저장
    const hasSaved = this.model.saveComplexCmd(reqComplexCmd.wrapCmdType, complexCmdWrap);

    // 복합 명령 실행 요청
    // FIXME: 장치와의 연결이 해제되었더라도 일단 명령 요청을 함. 연결이 해제되면 아에 명령 요청을 거부할지. 어떻게 해야할지 고민 필요
    this.executeCommandToDLC(complexCmdWrap);

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

    const { uuid: integratedUUID, wrapCmdId, wrapCmdName, wrapCmdType } = complexCmdWrapInfo;

    // 아직 요청 전이므로 complexCmdContainerList 순회하면서 명령 생성 및 요청
    complexCmdWrapInfo.complexCmdContainerList.forEach(complexCmdContainerInfo => {
      const { controlValue, controlSetValue } = complexCmdContainerInfo;

      // const hasFirst = true;
      complexCmdContainerInfo.complexEleList.forEach(complexCmdEleInfo => {
        const { nodeId, rank, uuid } = complexCmdEleInfo;
        // if (hasFirst) {
        /** @type {executeCmdInfo} */
        const executeCmd = {
          integratedUUID,
          wrapCmdId,
          wrapCmdName,
          wrapCmdType,
          controlValue,
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
    const hasTransferInquiryStatus = this.executeComplexCmd(reqComplexCmd);

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
