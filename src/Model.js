const _ = require('lodash');

const {
  BU
} = require('base-util-jh');

const Control = require('./Control');
const DataLoggerController = require('../DataLoggerController');

const {
  combinedOrderType,
  requestCommandType,
  requestDeviceControlType
} = require('../../default-intelligence').dcmConfigModel;
class Model {
  /**
   * Creates an instance of Model.
   * @param {Control} controller
   * @memberof Model
   */
  constructor(controller) {


    this.dataLoggerControllerList = controller.dataLoggerControllerList;
    this.dataLoggerList = controller.dataLoggerList;
    this.nodeList = controller.nodeList;


    this.nodeStatusList = {};


    this.initCombinedOrderStorage();

  }

  /**
   * 복합 명령 저장소를 초기화
   */
  initCombinedOrderStorage() {
    /** @type {combinedOrderStorage} */
    let orderStorage = {
      controlStorage: {
        waitingList: [],
        proceedingList: [],
        runningList: [],
      },
      cancelStorage: {
        waitingList: [],
        proceedingList: [],
      },
      measureStorage: {
        waitingList: [],
        proceedingList: [],
      }
    };
    this.combinedOrderStorage = orderStorage;
  }

  /**
   * @param {string} commandType CONTROL, CANCEL, MEASURE
   * @return {combinedOrderInfo}
   */
  findCombinedOrder(commandType) {
    // commandSet.
    let combinedOrder;
    switch (commandType) {
    case requestCommandType.CONTROL:
      combinedOrder = this.combinedOrderStorage.controlStorage;
      break;
    case requestCommandType.CANCEL:
      combinedOrder = this.combinedOrderStorage.cancelStorage;
      break;
    case requestCommandType.MEASURE:
      combinedOrder = this.combinedOrderStorage.measureStorage;
      break;
    default:
      combinedOrder = this.combinedOrderStorage.measureStorage;
      break;
    }

    return combinedOrder;
  }

  /**
   * 
   * @param {string} requestCommandId 명령을 내릴 때 해당 명령의 고유 ID(mode5, mode3, ...)
   * @param {combinedOrderInfo} combinedOrder 복합 명령 관리 구조
   * @return {{combinedOrderKey: string, combinedOrderIndex: number, combinedOrderWrap: combinedOrderWrapInfo }} 
   */
  findCombinedWrap(requestCommandId, combinedOrder) {
    try {
      // combinedID 가 동일한 녀석을 찾음
      // type : waitingList, proceedingList, runningList
      let combinedOrderKey = '';
      let combinedOrderIndex;
      /** @type {combinedOrderWrapInfo} */
      let foundCombinedOrderWrapInfo;
      _.forEach(combinedOrder, (combinedOrderWrapList, storageKey) => {
        // index를 찾았다면 조회 중지
        if (_.isNumber(combinedOrderIndex)) {
          return false;
        }
        // ID가 동일한 인덱스를 찾음
        const foundIndex = _.findIndex(combinedOrderWrapList, {
          requestCommandId
        });
        // 0 이상이면 해당 배열에 존재한다는 것
        if (foundIndex >= 0) {
          combinedOrderKey = storageKey;
          combinedOrderIndex = foundIndex;
          foundCombinedOrderWrapInfo = combinedOrderWrapList[foundIndex];
        }
      });
      return {
        combinedOrderKey, combinedOrderIndex,
        combinedOrderWrap: foundCombinedOrderWrapInfo
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * CombineOrderContainer 반환
   * @param {number} controlValue  requestDeviceControlType
   * @param {combinedOrderWrapInfo} combinedOrderWrapInfo 
   */
  findCombineOrderContainer(controlValue, combinedOrderWrapInfo) {
    try {
      return _.find(combinedOrderWrapInfo.orderContainerList, {controlValue});
    } catch (error) {
      throw error;
    }
  }

  /**
   * 
   * @param {string} uuid 
   * @param {combinedOrderWrapInfo} combinedOrderWrapInfo 
   */
  findCombineOrderElement(uuid, combinedOrderWrapInfo) {
    try {
      const combinedOrderElement = _(combinedOrderWrapInfo).map(_.pick('orderContainerList')).flatten().find({uuid});
      
      return combinedOrderElement;
    } catch (error) {
      throw error;
    }


  }



  /**
   * 저장소 데이터 관리. Data Logger Controller 객체로 부터 Message를 받은 경우 msgCode에 따라서 관리
   * @example
   * Device Client로부터 Message 수신
   * @param {DataLoggerController} dataLoggerController Data Logger Controller 객체
   * @param {dcMessage} dcMessage 명령 수행 결과 데이터
   */
  manageCombinedStorage(dataLoggerController, dcMessage) {
    const {
      COMMANDSET_EXECUTION_START,
      COMMANDSET_EXECUTION_TERMINATE,
      COMMANDSET_DELETE
    } = dataLoggerController.definedCommandSetMessage;

    const combinedOrder = this.findCombinedOrder(dcMessage.commandSet.commandType);
    // requestCommandType에 맞는 저장소가 없는 경우 
    if (combinedOrder === undefined) {
      throw new Error(`requestCommandType: ${dcMessage.commandSet.commandType} is not exist.`);
    }

    const {combinedOrderIndex, combinedOrderKey, combinedOrderWrap} = this.findCombinedWrap(dcMessage.commandSet.commandId, combinedOrder);

    // BU.CLIN(this.combinedOrderStorage, 7);

    // 조건에 맞는 CombinedOrderWrapInfo를 찾지 못하였다면
    if (combinedOrderWrap === undefined) {
      throw new Error(`requestCommandId: ${dcMessage.commandSet.commandId} is not exist.`);
    }


    // 명령 코드가 COMMANDSET_EXECUTION_START 이고 아직 combinedOrderType.WAIT 상태라면 PROCEEDING 상태로 이동하고 종료
    if (dcMessage.msgCode === COMMANDSET_EXECUTION_START && combinedOrderKey === combinedOrderType.WAIT) {
      BU.CLI(`requestCommandId: ${combinedOrderWrap.requestCommandId} 작업 시작`);
      return combinedOrder.proceedingList.push(_.head(_.pullAt(combinedOrder[combinedOrderKey], combinedOrderIndex)));
    }
    // 명령 코드가 완료(COMMANDSET_EXECUTION_TERMINATE), 삭제(COMMANDSET_DELETE) 일 경우
    else if ([COMMANDSET_EXECUTION_TERMINATE, COMMANDSET_DELETE].includes(dcMessage.msgCode)) {
      BU.CLI('작업 완료', combinedOrderWrap.requestCommandId);

      const res = this.findCombineOrderElement(dcMessage.commandSet.uuid, combinedOrderWrap);
      BU.CLI(res);

    }


    // // Message에 따라서 행동 개시    
    // switch (dcMessage.msgCode) {
    //   case COMMANDSET_EXECUTION_START:
    //     combinedOrderKey === combinedOrderType.WAIT ?
    //       case this.definedCommandSetMessage.COMMANDSET_EXECUTION_TERMINATE:
    //   case this.definedCommandSetMessage.COMMANDSET_DELETE:
    //     // BU.CLIN(this.model.requestCommandSetList);
    //     this.model.completeRequestCommandSet(dcMessage.commandSet);
    //     // Observer가 해당 메소드를 가지고 있다면 전송
    //     // this.observerList.forEach(observer => {
    //     //   if (_.get(observer, 'notifyCompleteOrder')) {
    //     //     observer.notifyCompleteOrder(this, dcMessage.commandSet);
    //     //   }
    //     // });
    //     // BU.CLIN(this.model.requestCommandSetList);
    //     break;
    //   default:
    //     break;
    // }


  }


  /**
   * TODO: 구현
   * 복합 명령을 저장소 호출
   * @param {string} commandType 저장할 타입 ADD, CANCEL, ''
   */
  getCombineOrderInfo(commandType) {
    const MEASURE = ['', undefined, null];
    const CONTROL = ['ADD', 'CONTROL'];
    const CANCEL = ['CANCEL'];

  }

  /**
   * 복합 명령을 저장
   * @param {string} commandType 저장할 타입 ADD, CANCEL, ''
   * @param {combinedOrderWrapInfo} combinedOrderWrapInfo 
   */
  saveCombinedOrder(commandType, combinedOrderWrapInfo) {
    // MEASURE DEFAULT
    // const MEASURE = [requestCommandType.MEASURE, '', undefined, null];
    const CONTROL = [requestCommandType.CONTROL];
    const CANCEL = [requestCommandType.CANCEL];

    // Measure
    if (_.includes(CONTROL, commandType)) {
      this.combinedOrderStorage.controlStorage.waitingList.push(combinedOrderWrapInfo);
    } else if (_.includes(CANCEL, commandType)) {
      this.combinedOrderStorage.cancelStorage.waitingList.push(combinedOrderWrapInfo);
    } else {
      this.combinedOrderStorage.measureStorage.waitingList.push(combinedOrderWrapInfo);
    }

    // BU.CLIN(this.combinedOrderStorage);
  }



  checkValidateNodeData(nodeInfo, standardDate) {

  }



}
module.exports = Model;