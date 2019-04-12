const _ = require('lodash');
const uuidv4 = require('uuid/v4');

const { BU } = require('base-util-jh');

const { dcmConfigModel, dccFlagModel } = require('../../default-intelligence');

const { requestOrderCommandType, requestDeviceControlType } = dcmConfigModel;
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
   * @param {requestSingleOrderInfo} requestSingleOrderInfo
   */
  executeSingleControl(requestSingleOrderInfo) {
    // BU.CLI('executeSingleControl');
    process.env.LOG_DBS_EXEC_SC === '1' && BU.CLIN(requestSingleOrderInfo);

    const {
      requestCommandType,
      nodeId,
      controlValue,
      controlSetValue,
      rank = definedCommandSetRank.SECOND,
    } = requestSingleOrderInfo;
    const nodeInfo = _.find(this.nodeList, { node_id: nodeId });
    try {
      /** @type {requestCombinedOrderInfo} */
      const requestCombinedOrder = {
        requestCommandId: `S_${nodeId}_${this.convertControlValueToString(nodeInfo, controlValue)}`,
        requestCommandName: '',
        requestCommandType,
        requestElementList: [],
      };

      /** @type {requestOrderElementInfo} */
      const requestOrderElement = { nodeId, controlValue, controlSetValue, rank };

      requestCombinedOrder.requestElementList.push(requestOrderElement);

      return this.executeCombineCommand(requestCombinedOrder);
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

    /** @type {requestCombinedOrderInfo} */
    const requestCombinedOrder = {
      requestCommandId: cmdName,
      requestCommandName: `${cmdName} ${requestOrderCommandType.CONTROL}`,
      requestCommandType: requestOrderCommandType.CONTROL,
      requestElementList: [],
    };

    // 장치 True 요청
    if (trueList.length) {
      requestCombinedOrder.requestElementList.push({
        controlValue: requestDeviceControlType.TRUE,
        nodeId: trueList,
        rank: definedCommandSetRank.SECOND,
      });
    }

    // 장치 False 요청
    if (falseList.length) {
      requestCombinedOrder.requestElementList.push({
        controlValue: requestDeviceControlType.FALSE,
        nodeId: falseList,
        rank: definedCommandSetRank.SECOND,
      });
    }

    return this.executeCombineCommand(requestCombinedOrder);
  }

  /**
   * 명령 취소 요청
   * @param {{cmdName: string, trueList: string[], falseList: string[]}} controlInfo
   */
  cancelAutomaticControl(controlInfo) {
    process.env.LOG_DBS_EXEC_AC === '1' && BU.CLI(controlInfo);

    const { cmdName, trueList = [], falseList = [] } = controlInfo;
    /** @type {requestCombinedOrderInfo} */
    const requestCombinedOrder = {
      requestCommandId: cmdName,
      requestCommandName: `${cmdName} ${requestOrderCommandType.CANCEL}`,
      requestCommandType: requestOrderCommandType.CANCEL,
      requestElementList: [],
    };

    // 장치 False 요청 (켜져 있는 장치만 끔)
    if (trueList.length) {
      requestCombinedOrder.requestElementList.push({
        controlValue: requestDeviceControlType.FALSE,
        nodeId: _.reverse(trueList),
        rank: definedCommandSetRank.SECOND,
      });
    }

    // FIXME: 명령 취소에 대한 논리 정립이 안되어 있어 다시 동작 시키는 명령은 비활성
    // 장치 True 요청
    // if (falseList.length) {
    //   requestCombinedOrder.requestElementList.push({
    //     controlValue: requestDeviceControlType.TRUE,
    //     nodeId: _.reverse(falseList),
    //     rank: 2,
    //   });
    // }

    return this.executeCombineCommand(requestCombinedOrder);
  }

  /**
   * 저장된 명령 요청 수행
   * @param {{savedCommandId: string, requestCommandType: string }} savedCommandInfo 저장된 명령 ID
   */
  executeSavedCommand(savedCommandInfo) {
    try {
      const { savedCommandId, requestCommandType } = savedCommandInfo;
      const foundIt = _.find(this.model.excuteControlList, { cmdName: savedCommandId });
      if (foundIt) {
        const { trueList = [], falseList = [] } = foundIt;
        // 명령 제어 요청 일 경우
        if (requestCommandType === requestOrderCommandType.CONTROL) {
          return this.executeAutomaticControl({
            cmdName: savedCommandId,
            trueList,
            falseList,
          });
        }
        if (requestCommandType === requestOrderCommandType.CANCEL) {
          // 명령 취소 일 경우
          return this.cancelAutomaticControl({
            cmdName: savedCommandId,
            trueList,
            falseList,
          });
        }
        throw new Error(`commandType: ${requestCommandType} can not be identified. `);
      }
      throw new Error(`commandId: ${savedCommandId} does not exist.`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 복합 명령 실행 요청
   * @param {requestCombinedOrderInfo} requestCombinedOrder
   * @return {boolean} 명령 요청 여부
   */
  executeCombineCommand(requestCombinedOrder) {
    // BU.CLI(requestCombinedOrder);
    process.env.LOG_DBS_EXEC_CO_HEADER === '1' && BU.CLI('execCombineOrder', requestCombinedOrder);

    // 복합 명령을 해체하여 정의
    const {
      requestCommandId,
      requestCommandType,
      requestCommandName,
      requestElementList,
    } = requestCombinedOrder;

    /** @type {combinedOrderWrapInfo} */
    const combinedWrapOrder = {
      uuid: uuidv4(),
      requestCommandId,
      requestCommandType,
      requestCommandName,
      orderContainerList: [],
    };

    // 요청 복합 명령 객체의 요청 리스트를 순회하면서 combinedOrderContainerInfo 객체를 만들고 삽입
    requestElementList.forEach(requestElementInfo => {
      const {
        nodeId,
        controlValue = requestDeviceControlType.MEASURE,
        controlSetValue,
        rank = definedCommandSetRank.THIRD,
      } = requestElementInfo;
      // nodeId가 string이라면 배열생성 후 집어넣음
      const nodeList = _.isArray(nodeId) ? nodeId : [nodeId];

      // 해당 controlValue가 orderElementList 기존재하는지 체크
      let foundRemainInfo = _.find(combinedWrapOrder.orderContainerList, {
        controlValue,
      });
      // 없다면
      if (!foundRemainInfo) {
        foundRemainInfo = {
          controlValue,
          controlSetValue,
          orderElementList: [],
        };
        combinedWrapOrder.orderContainerList.push(foundRemainInfo);
      }

      // 배열을 반복하면서 element를 생성 후 remainInfo에 삽입
      _.forEach(nodeList, currNodeId => {
        // BU.CLI(currNodeId);
        // 장치와 연결되어 있는 DLC 불러옴
        const dataLoggerController = this.model.findDataLoggerController(currNodeId);
        // 해당하는 DLC가 없거나 장치가 비접속이라면 명령을 수행하지 않음
        // TODO: requestCombinedOrder의 실행 가능 여부를 판단하고 명령에서 제외하는 것이 맞는지 검증 필요
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
          //   'executeCombineCommand',
          //   `mainUUID: ${
          //     this.mainUUID
          //   } nodeId: ${currNodeId} controlValue: ${controlValue} msg: ${errMsg}`,
          // );
        } else {
          /** @type {combinedOrderElementInfo} */
          const elementInfo = {
            hasComplete: false,
            nodeId: currNodeId,
            rank,
            uuid: uuidv4(),
          };

          foundRemainInfo.orderElementList.push(elementInfo);
        }
      });
    });

    process.env.LOG_DBS_EXEC_CO_TAIL === '1' && BU.CLIN(combinedWrapOrder, 2);

    // 복합 명령 저장
    const hasSaved = this.model.saveCombinedOrder(
      requestCombinedOrder.requestCommandType,
      combinedWrapOrder,
    );

    // 복합 명령 실행 요청
    // FIXME: 장치와의 연결이 해제되었더라도 일단 명령 요청을 함. 연결이 해제되면 아에 명령 요청을 거부할지. 어떻게 해야할지 고민 필요
    this.executeCommandToDLC(combinedWrapOrder);

    return hasSaved;
  }

  /**
   * Data Logger Controller로 실제로 명령을 요청하는 메소드
   * @param {combinedOrderWrapInfo} combinedOrderWrapInfo
   * @memberof Control
   */
  executeCommandToDLC(combinedOrderWrapInfo) {
    // BU.CLI(combinedOrderWrapInfo)
    process.env.LOG_DBS_TRANS_ORDER === '1' && BU.CLI('transferRequestOr', combinedOrderWrapInfo);

    const {
      uuid: integratedUUID,
      requestCommandId,
      requestCommandName,
      requestCommandType,
    } = combinedOrderWrapInfo;

    // 아직 요청 전이므로 orderContainerList 순회하면서 명령 생성 및 요청
    combinedOrderWrapInfo.orderContainerList.forEach(combinedOrderContainerInfo => {
      const { controlValue, controlSetValue } = combinedOrderContainerInfo;

      // const hasFirst = true;
      combinedOrderContainerInfo.orderElementList.forEach(combinedOrderElementInfo => {
        const { nodeId, rank, uuid } = combinedOrderElementInfo;
        // if (hasFirst) {
        /** @type {executeOrderInfo} */
        const executeOrder = {
          integratedUUID,
          requestCommandId,
          requestCommandName,
          requestCommandType,
          controlValue,
          controlSetValue,
          nodeId,
          rank,
          uuid,
        };

        const dataLoggerController = this.model.findDataLoggerController(nodeId);

        dataLoggerController.orderOperation(executeOrder);
        // hasFirst = false;
        // }
      });
    });
  }

  /**
   * 정기적인 Router Status 탐색
   */
  inquiryAllDeviceStatus() {
    // BU.CLI('inquiryAllDeviceStatus');
    process.env.LOG_DBS_INQUIRY_START === '1' &&
      BU.CLI(`${this.makeCommentMainUUID()} Start inquiryAllDeviceStatus`);

    /** @type {requestCombinedOrderInfo} */
    const requestCombinedOrder = {
      requestCommandId: 'inquiryAllDeviceStatus',
      requestCommandName: '정기 장치 상태 계측',
      requestCommandType: requestOrderCommandType.MEASURE,
      requestElementList: [{ nodeId: _.map(this.dataLoggerList, 'dl_id') }],
    };

    // BU.CLI(_.map(this.dataLoggerList, 'dl_id'));

    // 명령 요청
    const hasTransferInquiryStatus = this.executeCombineCommand(requestCombinedOrder);

    // BU.CLI(hasTransferInquiryStatus);

    // 장치와의 접속이 이루어지지 않을 경우 명령 전송하지 않음
    if (!hasTransferInquiryStatus) {
      BU.log(`${this.makeCommentMainUUID()} Empty Order inquiryAllDeviceStatus`);
      return false;
    }

    // Data Logger 현재 상태 조회
    // this.dataLoggerControllerList.forEach(router => {
    //   /** @type {requestOrderInfo} */
    //   let ruquestOrder = {};
    //   ruquestOrder.nodeId = 'DEFAULT';
    //   ruquestOrder.requestCommandType = 'ADD';
    //   ruquestOrder.requestCommandId = 'regularDiscovery';

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
