const _ = require('lodash');
const moment = require('moment');

const { BU } = require('base-util-jh');
const { BM } = require('../../base-model-jh');

const ControlDBS = require('./Control');

const { dcmWsModel, dcmConfigModel } = require('../../default-intelligence');

const {
  combinedOrderType,
  requestOrderCommandType,
  simpleOrderStatus,
  nodePickKey,
} = dcmConfigModel;

const { transmitToServerCommandType } = dcmWsModel;

// const map = require('../config/map');

class Model {
  /**
   * Creates an instance of Model.
   * @param {ControlDBS} controller
   * @memberof Model
   */
  constructor(controller) {
    this.controller = controller;
    this.dataLoggerControllerList = controller.dataLoggerControllerList;
    this.dataLoggerList = controller.dataLoggerList;
    this.nodeList = controller.nodeList;

    this.initCombinedOrderStorage();

    this.BM = new BM(this.controller.config.dbInfo);

    /** @type {simpleOrderInfo[]} */
    this.simpleOrderList = [];

    // FIXME: 임시로 자동 명령 리스트 넣어둠. DB에서 가져오는 걸로 수정해야함(2018-07-30)
    // this.excuteControlList = map.controlList;
  }

  /**
   * DBS가 사용하는 Device Map을 설정
   */
  async setMap() {
    const { uuid } = this.controller.config;
    /** @type {MAIN[]} */
    const mainList = await this.BM.getTable('main', { uuid });
    if (_.isEmpty(mainList)) {
      throw new Error(`Main UUID: ${uuid}는 존재하지 않습니다.`);
    }
    const mainInfo = _.head(mainList);

    /** @type {MAIN_MAP[]} */
    const mapList = await this.BM.getTable('main_map', { main_seq: mainInfo.main_seq });
    if (_.isEmpty(mapList)) {
      throw new Error(`Map UUID: ${uuid}는 존재하지 않습니다.`);
    }
    /** @type {mDeviceMap} */
    this.deviceMap = JSON.parse(_.head(mapList).contents);
    this.excuteControlList = _.get(this.deviceMap, 'controlInfo.tempControlList', []);
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
   * simpleOrderInfo 를 새로이 입력하고자 할 경우
   * @param {simpleOrderInfo} simpleOrderInfo
   * @return {boolean} 정상적인 신규 데이터 삽입이 이루어지면 true, 아니면 false
   */
  setSimpleOrderInfo(simpleOrderInfo) {
    BU.CLI(this.controller.mainUUID, simpleOrderInfo);
    // 아직 접속이 이루어져있지 않을 경우 보내지 않음
    if (_.isEmpty(_.get(this, 'controller.socketClient.client'))) {
      return false;
    }
    const foundIt = _.find(this.simpleOrderList, { uuid: simpleOrderInfo.uuid });
    // 기존에 존재한다면
    if (foundIt) {
      return false;
    }
    // 신규 삽입
    this.simpleOrderList.push(simpleOrderInfo);

    // 신규 알림
    this.controller.socketClient.transmitDataToServer({
      commandType: transmitToServerCommandType.COMMAND,
      data: [simpleOrderInfo],
    });
  }

  /**
   * 기존에 존재하던 명령의 수정이 이루어 질때
   * @param {string} uuid
   * @param {string} orderStatus combinedOrderType
   * @return {boolean} 갱신이 이루어지면 true, 아니면 false
   */
  updateSimpleOrderInfo(uuid, orderStatus) {
    // 아직 접속이 이루어져있지 않을 경우 보내지 않음
    if (_.isEmpty(_.get(this, 'controller.socketClient.client'))) {
      return false;
    }
    const simpleOrderInfo = _.find(this.simpleOrderList, { uuid });
    // BU.CLI(orderStatus, simpleOrderInfo);
    // 데이터가 존재한다면 해당 명령의 변화가 생긴 것
    if (simpleOrderInfo) {
      // orderStatus 가 정상적인 데이터이고 기존 데이터와 다르다면
      if (
        _(simpleOrderStatus)
          .values()
          .includes(orderStatus) &&
        !_.isEqual(simpleOrderInfo.orderStatus, orderStatus)
      ) {
        simpleOrderInfo.orderStatus = orderStatus;

        // 명령이 완료됐다면 Simple Order List에서 삭제
        if (orderStatus === simpleOrderStatus.COMPLETE) {
          _.pullAllWith(this.simpleOrderList, [simpleOrderInfo], _.isEqual);
        }

        // BU.CLI(this.simpleOrderList);

        // const dlc = this.findDataLoggerController('V_001');
        // BU.CLIN(dlc.nodeList);

        // 업데이트 알림 (통째로 보내버림)
        this.controller.socketClient.transmitDataToServer({
          commandType: transmitToServerCommandType.COMMAND,
          data: this.simpleOrderList,
        });
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  /**
   * 명령을 기반으로 Order Storage 내용 반환
   * @param {string} integratedUUID 명령을 내릴 때 해당 명령의 고유 ID(mode5, mode3, ...)
   */
  findAllCombinedOrderByUUID(integratedUUID) {
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
          uuid: integratedUUID,
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
            const foundIt = _.find(containerInfo.orderElementList, { uuid });
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
      case requestOrderCommandType.CONTROL:
        combinedOrder = this.combinedOrderStorage.controlStorage;
        break;
      case requestOrderCommandType.CANCEL:
        combinedOrder = this.combinedOrderStorage.cancelStorage;
        break;
      case requestOrderCommandType.MEASURE:
        combinedOrder = this.combinedOrderStorage.measureStorage;
        break;
      default:
        combinedOrder = this.combinedOrderStorage.measureStorage;
        break;
    }

    return combinedOrder;
  }

  /**
   * Data logger와 연결되어 있는 컨트롤러를 반환
   * @param {dataLoggerInfo|string} searchValue string: dl_id, node_id or Object: DataLogger
   */
  findDataLoggerController(searchValue) {
    BU.CLI(searchValue);
    // Node Id 일 경우
    if (_.isString(searchValue)) {
      // Data Logger List에서 찾아봄
      // BU.CLIN(this.dataLoggerList);
      const dataLoggerInfo = _.find(this.dataLoggerList, {
        dl_id: searchValue,
      });

      if (dataLoggerInfo) {
        searchValue = dataLoggerInfo;
      } else {
        // 없다면 노드에서 찾아봄
        const nodeInfo = _.find(this.nodeList, {
          node_id: searchValue,
        });
        // string 인데 못 찾았다면 존재하지 않음. 예외 발생
        if (_.isEmpty(nodeInfo)) {
          throw new Error(`Node ID: ${searchValue} is not exist`);
        }
        searchValue = nodeInfo.getDataLogger();
      }
    }

    // BU.CLIN(this.dataLoggerControllerList);
    return _.find(this.dataLoggerControllerList, router =>
      _.isEqual(router.dataLoggerInfo, searchValue),
    );
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

    const { commandSet } = dcMessage;

    // BU.CLIN(commandSet);
    // 명령 타입에 따라서 저장소를 가져옴(Control, Cancel, Measure)

    const resOrderInfo = this.findAllCombinedOrderByUUID(commandSet.integratedUUID);

    // requestCommandType에 맞는 저장소가 없는 경우
    if (!resOrderInfo.orderStorageKeyLV1.length) {
      throw new Error(`requestCommandType: ${commandSet.commandType} is not exist.`);
    }

    // 조건에 맞는 CombinedOrderWrapInfo를 찾지 못하였다면
    if (_.isEmpty(resOrderInfo.orderWrapInfoLV3)) {
      throw new Error(`requestCommandId: ${dcMessage.commandSet.commandId} is not exist.`);
    }

    // 복합 명령 현황 저장소 key 형태를 보고 명령 타입을 정의
    // TODO: orderStorageType에 따라 명령 요청, 취소 요청 처리 필요
    // let orderStorageType = '';
    // switch (resOrderInfo.orderStorageKeyLV1) {
    //   case 'controlStorage':
    //     orderStorageType = requestOrderCommandType.CONTROL;
    //     break;
    //   case 'cancelStorage':
    //     orderStorageType = requestOrderCommandType.CANCEL;
    //     break;
    //   case 'measureStorage':
    //     orderStorageType = requestOrderCommandType.MEASURE;
    //     break;
    //   default:
    //     break;
    // }

    // BU.CLIN(commandSet);
    // BU.CLIN(commandSet.commandId, commandSet.uuid);

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

      // 진행중 명령 저장소 목록에 삽입
      resOrderInfo.orderStorageLV1.proceedingList.push(newOrderInfo);
      // simpleOrderList 갱신
      this.updateSimpleOrderInfo(resOrderInfo.orderWrapInfoLV3.uuid, simpleOrderStatus.PROCEED);
      return false;
    }
    // 명령 코드가 완료(COMMANDSET_EXECUTION_TERMINATE), 삭제(COMMANDSET_DELETE) 일 경우
    const completeKeyList = [COMMANDSET_EXECUTION_TERMINATE, COMMANDSET_DELETE];
    // 작업 완료로 교체
    if (completeKeyList.includes(dcMessage.msgCode)) {
      // BU.CLI(
      //   '작업 완료',
      //   `${resOrderInfo.orderWrapInfoLV3.requestCommandId} ${dcMessage.commandSet.nodeId}`,
      // );
      // orderElement를 가져옴

      // controlValue에 상관없이 flatten 형태로 모두 가져옴
      const flatOrderElementList = _(resOrderInfo.orderWrapInfoLV3.orderContainerList)
        .map('orderElementList')
        .flatten()
        .value();

      // 가져온 flatten 리스트에서 uuid가 동일한 객체 검색
      // const orderElementInfo = _.find(flatOrderElementList, {
      //   uuid: commandSet.uuid,
      // });

      _.set(
        _.find(flatOrderElementList, {
          uuid: commandSet.uuid,
        }),
        'hasComplete',
        true,
      );

      // BU.CLI('NodeID', orderElementInfo.nodeId);

      // 완료 처리
      // if (orderElementInfo) {
      //   orderElementInfo.hasComplete = true;
      //   // NOTE: 한개의 동작이 완료 됐을 때 특별한 동작을 하고 싶을 경우 이하 작성
      // }

      // TEST: 작업 세부 과정의 최종 완료 여부를 콘솔에서 확인하기 위해 간단히 가져옴
      const flatSimpleList = _.map(flatOrderElementList, ele =>
        _.pick(ele, ['hasComplete', 'nodeId']),
      );
      // BU.CLI(resOrderInfo.orderWrapInfoLV3.requestCommandId, flatSimpleList);
      if (_.every(flatOrderElementList, 'hasComplete')) {
        BU.CLI('All Completed CommandId: ', dcMessage.commandSet.commandId);
        // proceedingList에서 제거
        const completeOrderInfo = _.head(
          _.pullAt(
            resOrderInfo.orderStorageLV1[resOrderInfo.orderInfoKeyLV2],
            resOrderInfo.orderInfoIndexLV2,
          ),
        );
        if (completeOrderInfo === undefined) {
          BU.CLI('해당 객체는 존재하지 않습니다.');
          throw new Error('해당 객체는 존재하지 않습니다.');
        }

        this.getAllNodeStatus(nodePickKey.FOR_DATA);

        // FIXME: emit 처리의 논리가 맞는지 체크
        if (resOrderInfo.orderWrapInfoLV3.requestCommandId === 'discoveryRegularDevice') {
          BU.CLI('Comlete discoveryRegularDevice');
          this.controller.emit('completeDiscovery');
        } else {
          this.controller.emit('completeOrder', dcMessage.commandSet.commandId);
        }

        // FIXME: 명령 제어에 대한 자세한 논리가 나오지 않았기 때문에 runningList로 이동하지 않음. (2018-07-23)
        // FIXME: RUNNING 리스트 없이 무조건 완료 처리함. 실행 중인 명령을 추적하고자 할경우 추가적인 논리 필요
        this.updateSimpleOrderInfo(resOrderInfo.orderWrapInfoLV3.uuid, simpleOrderStatus.COMPLETE);

        // 명령 제어 요청일 경우 runningList로 이동
        // if (commandSet.commandType === requestCommandType.CONTROL) {
        //   resOrderInfo.orderStorageLV1.runningList.push(completeOrderInfo);
        // }

        // BU.CLI(resOrderInfo.orderStorageLV1);

        // TODO: 명령이 모두 완료 되었을 때 하고 싶은 행동 이하 작성
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
   * 복합 명령을 저장
   * @param {string} commandType 저장할 타입 ADD, CANCEL, ''
   * @param {combinedOrderWrapInfo} combinedOrderWrapInfo
   */
  saveCombinedOrder(commandType, combinedOrderWrapInfo) {
    BU.CLI('saveCombinedOrder');
    /**
     * Socket Server로 전송하기 위한 명령 추가 객체 생성
     * @type {simpleOrderInfo}
     */
    const simpleOrder = {
      orderCommandType: '',
      orderStatus: simpleOrderStatus.NEW,
      commandId: combinedOrderWrapInfo.requestCommandId,
      commandName: combinedOrderWrapInfo.requestCommandName,
      uuid: combinedOrderWrapInfo.uuid,
    };
    // MEASURE DEFAULT
    // const MEASURE = [requestCommandType.MEASURE, '', undefined, null];
    const CONTROL = [requestOrderCommandType.CONTROL];
    const CANCEL = [requestOrderCommandType.CANCEL];

    // Measure
    if (_.includes(CONTROL, commandType)) {
      simpleOrder.orderCommandType = requestOrderCommandType.CONTROL;
      this.combinedOrderStorage.controlStorage.waitingList.push(combinedOrderWrapInfo);
    } else if (_.includes(CANCEL, commandType)) {
      simpleOrder.orderCommandType = requestOrderCommandType.CANCEL;
      this.combinedOrderStorage.cancelStorage.waitingList.push(combinedOrderWrapInfo);
    } else {
      simpleOrder.orderCommandType = requestOrderCommandType.MEASURE;
      this.combinedOrderStorage.measureStorage.waitingList.push(combinedOrderWrapInfo);
    }

    // 새로 생성된 명령 추가
    this.setSimpleOrderInfo(simpleOrder);
    // BU.CLIN(this.combinedOrderStorage);
  }

  /**
   * 모든 노드가 가지고 있는 정보 출력
   * @param {nodePickKey} nodePickKeyList
   */
  getAllNodeStatus(nodePickKeyList) {
    const statusList = _(this.nodeList)
      .map(nodeInfo => {
        if (nodePickKeyList) {
          return _.pick(nodeInfo, nodePickKeyList);
        }
        return nodeInfo;
      })
      .orderBy('node_id')
      .value();
    // BU.CLI(statusList);
    return statusList;
    // BU.CLI(this.nodeList);
  }

  /**
   * 노드 리스트 중 입력된 날짜를 기준으로 유효성을 가진 데이터만 반환
   * @param {nodeInfo[]} nodeList
   * @param {timeIntervalToValidateInfo} diffInfo
   * @param {moment.Moment} momentDate
   * @return {nodeInfo[]}
   */
  checkValidateNodeData(nodeList, diffInfo, momentDate) {
    // 날짜 차이를 구할 키를 설정
    const diffType = diffInfo.diffType || 'minutes';
    // 날짜 차이를 허용할 수 설정
    const durationNumber = diffInfo.duration || 1;
    // 기준이 될 현재 시간 설정
    const now = momentDate || moment();
    // 입력된 노드 리스트를 돌면서 유효성 검증
    return nodeList.filter(nodeInfo => {
      // 날짜 차 계산
      const diffNum = now.diff(moment(nodeInfo.writeDate), diffType);
      // 날짜 차가 허용 범위를 넘어섰다면 유효하지 않는 데이터
      if (diffNum > durationNumber) {
        // BU.CLI(
        //   `${
        //     nodeInfo.node_id
        //   }는 날짜(${diffType}) 차이가 허용 범위(${permitValue})를 넘어섰습니다. ${diffNum}`,
        // );
        return false;
      }
      // momentDate.format('YYYY-MM-DD HH:mm:ss'),
      return true;
    });
  }

  /**
   * DB에 데이터 삽입
   * @param {nodeInfo[]} nodeList 노드 리스트
   * @param {{hasSensor: boolean, hasDevice: boolean}} insertOption DB에 입력 처리 체크
   */
  async insertNodeDataToDB(nodeList, insertOption) {
    const returnValue = [];

    // BU.CLIN(nodeList);
    // 센서류 삽입
    if (insertOption.hasSensor) {
      const nodeSensorList = _(nodeList)
        .filter(ele => ele.is_sensor === 1)
        .map(ele =>
          BU.renameObj(_.pick(ele, ['node_seq', 'data', 'writeDate']), 'data', 'num_data'),
        )
        .value();
      // BU.CLI(nodeSensorList);
      const result = await this.BM.setTables('dv_sensor_data', nodeSensorList, false);
      returnValue.push(result);
    }

    // 장치류 삽입
    if (insertOption.hasDevice) {
      const nodeDeviceList = _(nodeList)
        .filter(ele => ele.is_sensor === 0)
        .map(ele =>
          BU.renameObj(_.pick(ele, ['node_seq', 'data', 'writeDate']), 'data', 'str_data'),
        )
        .value();

      // BU.CLI(nodeDeviceList);
      const result = await this.BM.setTables('dv_device_data', nodeDeviceList, false);
      returnValue.push(result);
    }
    return returnValue;
  }
}
module.exports = Model;
