const _ = require('lodash');

const {BU} = require('base-util-jh');

const Control = require('./Control');
const DataLoggerController = require('../DataLoggerController');

const {
  combinedOrderType,
  requestCommandType,
  requestDeviceControlType,
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
    const orderStorage = {
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
      },
    };
    this.combinedOrderStorage = orderStorage;
  }

  /**
   * 명령을 기반으로 Order Storage 내용 반환
   * @param {string} requestCommandId 명령을 내릴 때 해당 명령의 고유 ID(mode5, mode3, ...)
   */
  findAllCombinedOrderByCommandId(requestCommandId) {
    const returnValue = {
      orderStorageKeyLV1: '',
      /** @type {combinedOrderInfo} */
      orderStorageLV1: {},
      orderInfoKeyLV2: '',
      orderInfoIndexLV2: -1,
      /** @type {combinedOrderWrapInfo[]} */
      orderInfoListLV2: [],
      /** @type {combinedOrderWrapInfo} */
      orderWrapInfoLV3: {},
    };

    const hasFined = false;
    // 저장소를 순회
    _.forEach(this.combinedOrderStorage, (combinedOrderInfo, orderStorageType) => {
      if (hasFined) return false;
      // 각 저장소의 대기, 진행, 실행 목록 순회
      _.forEach(combinedOrderInfo, (combinedOrderWrapList, orderType) => {
        if (hasFined) return false;
        // 해당 명령을 가진 combinedOrderWrapInfo 검색
        const foundIndex = _.findIndex(combinedOrderWrapList, {
          requestCommandId,
        });
        // 0 이상이면 해당 배열에 존재한다는 것
        if (foundIndex >= 0) {
          returnValue.orderStorageKeyLV1 = orderStorageType;
          returnValue.orderStorageLV1 = combinedOrderInfo;
          returnValue.orderInfoKeyLV2 = orderType;
          returnValue.orderInfoIndexLV2 = foundIndex;
          returnValue.orderInfoListLV2 = combinedOrderWrapList;
          returnValue.orderWrapInfoLV3 = _.nth(combinedOrderWrapList, foundIndex);
        }
      });
    });

    return returnValue;
  }

  /**
   * UUID에 해당하는 Order Storage 내용 반환
   * @param {string} uuid UUID. 유일 키로 명령 요청 시 동적으로 생성 및 부여
   */
  findAllCombinedOrderByElementInfo(uuid) {
    const returnValue = {
      orderStorageKeyLV1: '',
      /** @type {combinedOrderInfo} */
      orderStorageLV1: {},
      orderInfoKeyLV2: '',
      /** @type {combinedOrderWrapInfo[]} */
      orderInfoListLV2: [],
      /** @type {combinedOrderWrapInfo} */
      orderWrapInfoLV3: {},
      /** @type {combinedOrderContainerInfo} */
      orderContainerInfoLV4: {},
      /** @type {combinedOrderElementInfo} */
      orderElementInfoLV5: {},
    };

    let hasFined = false;
    // 저장소를 순회
    _.forEach(this.combinedOrderStorage, (combinedOrderInfo, orderStorageType) => {
      if (hasFined) return false;
      // 각 저장소의 대기, 진행, 실행 목록 순회
      _.forEach(combinedOrderInfo, (combinedOrderWrapList, orderType) => {
        if (hasFined) return false;
        // 저장소에 저장된 명령 리스트 목록 순회
        _.forEach(combinedOrderWrapList, orderWrapInfo => {
          if (hasFined) return false;
          // 제어 목록별 명령 순회
          _.forEach(orderWrapInfo.orderContainerList, containerInfo => {
            if (hasFined) return false;
            // 해당 ID를 가진 combinedOrderWrapInfo 검색
            const foundIt = _.find(containerInfo.orderElementList, {uuid});
            if (foundIt) {
              hasFined = true;
              returnValue.orderStorageKeyLV1 = orderStorageType;
              returnValue.orderStorageLV1 = combinedOrderInfo;
              returnValue.orderInfoKeyLV2 = orderType;
              returnValue.orderInfoListLV2 = combinedOrderWrapList;
              returnValue.orderWrapInfoLV3 = orderWrapInfo;
              returnValue.orderContainerInfoLV4 = containerInfo;
              returnValue.orderElementInfoLV5 = foundIt;
            }
          });
        });
      });
    });

    return returnValue;
  }

  /**
   * @desc Find Step 1
   * 명령 요청에 따라 '제어', '취소', '계측' 저장소 리스트 반환
   * @param {string} commandType CONTROL, CANCEL, MEASURE
   * @return {combinedOrderInfo}
   */
  findCombinedOrderLV1(commandType) {
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
      COMMANDSET_DELETE,
    } = dataLoggerController.definedCommandSetMessage;

    const {commandSet} = dcMessage;

    // 명령 타입에 따라서 저장소를 가져옴(Control, Cancel, Measure)

    const resOrderInfo = this.findAllCombinedOrderByCommandId(commandSet.commandId);

    // requestCommandType에 맞는 저장소가 없는 경우
    if (!resOrderInfo.orderStorageKeyLV1.length) {
      throw new Error(`requestCommandType: ${commandSet.commandType} is not exist.`);
    }

    // 조건에 맞는 CombinedOrderWrapInfo를 찾지 못하였다면
    if (_.isEmpty(resOrderInfo.orderWrapInfoLV3)) {
      throw new Error(`requestCommandId: ${dcMessage.commandSet.commandId} is not exist.`);
    }

    // 명령 코드가 COMMANDSET_EXECUTION_START 이고 아직 combinedOrderType.WAIT 상태라면 PROCEEDING 상태로 이동하고 종료
    if (
      dcMessage.msgCode === COMMANDSET_EXECUTION_START &&
      resOrderInfo.orderInfoKeyLV2 === combinedOrderType.WAIT
    ) {
      BU.CLI(`${resOrderInfo.orderWrapInfoLV3.requestCommandId} 작업 시작`);
      // watingList에서 해당 명령 제거. pullAt은 배열 형태로 리턴하므로 첫번째 인자 가져옴.
      const newOrderInfo = _.head(
        _.pullAt(
          resOrderInfo.orderStorageLV1[resOrderInfo.orderInfoKeyLV2],
          resOrderInfo.orderInfoIndexLV2,
        ),
      );
      if (newOrderInfo === undefined) {
        throw new Error('해당 객체는 존재하지 않습니다.');
      }

      resOrderInfo.orderStorageLV1.proceedingList.push(newOrderInfo);
      return false;
    }
    // 명령 코드가 완료(COMMANDSET_EXECUTION_TERMINATE), 삭제(COMMANDSET_DELETE) 일 경우
    const completeKeyList = [COMMANDSET_EXECUTION_TERMINATE, COMMANDSET_DELETE];
    // 작업 완료로 교체
    if (completeKeyList.includes(dcMessage.msgCode)) {
      BU.CLI('작업 완료', resOrderInfo.orderWrapInfoLV3.requestCommandId);
      // orderElement를 가져옴

      // controlValue에 상관없이 flatten 형태로 모두 가져옴
      const flatOrderElementList = _(resOrderInfo.orderWrapInfoLV3.orderContainerList)
        .map('orderElementList')
        .flatten()
        .value();

      // 가져온 flatten 리스트에서 uuid가 동일한 객체 검색
      const orderElementInfo = _.find(flatOrderElementList, {uuid: commandSet.uuid});

      // 완료 처리
      if (orderElementInfo) {
        orderElementInfo.hasComplete = true;
        // NOTE: 한개의 동작이 완료 됐을 때 특별한 동작을 하고 싶을 경우 이하 작성
      }

      // 해당 명령이 모두 완료되었을 경우
      if (_.every(flatOrderElementList, 'hasComplete')) {
        BU.CLI('All Completed CommandId: ', dcMessage.commandSet.commandId);
        // TODO: 명령이 완료되었다면 명령 이동 및 삭제

        // NOTE: 명령이 모두 완료 되었을 때 하고 싶은 행동 이하 작성
      }

      // TODO: DB 입력
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

  checkValidateNodeData(nodeInfo, standardDate) {}
}
module.exports = Model;
