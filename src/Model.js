const _ = require('lodash');
const moment = require('moment');

const { BU } = require('base-util-jh');
const { BM } = require('base-model-jh');

const ControlDBS = require('./Control');

const { dcmWsModel, dcmConfigModel } = require('../../default-intelligence');

const {
  complexCmdStep,
  nodePickKey,
  complexCmdPickKey,
  controlModeInfo,
  goalDataRange,
  nodeDataType,
  reqWrapCmdType,
  requestDeviceControlType,
} = dcmConfigModel;

// API Server 와 데이터를 주고 받는 타입
const { transmitToServerCommandType, transmitToClientCommandType } = dcmWsModel;

class Model {
  /**
   * Creates an instance of Model.
   * @param {ControlDBS} controller
   * @memberof Model
   */
  constructor(controller) {
    this.controller = controller;

    const { config, dataLoggerControllerList, dataLoggerList, nodeList } = controller;

    this.dataLoggerControllerList = dataLoggerControllerList;
    this.dataLoggerList = dataLoggerList;
    this.nodeList = nodeList;

    /** @type {complexCmdWrapInfo[]} 복합 명령 실행 목록 */
    this.complexCmdList = [];

    this.biModule = new BM(config.dbInfo);

    // 정기 조회 Count
    this.inquirySchedulerIntervalSaveCnt = _.get(config, 'inquirySchedulerInfo.intervalSaveCnt', 1);
    this.inquirySchedulerCurrCount = 0;

    this.deviceMap = controller.deviceMap;

    // FIXME: 임시로 자동 명령 리스트 넣어둠. DB에서 가져오는 걸로 수정해야함(2018-07-30)
    this.excuteControlList = _.get(this.deviceMap, 'controlInfo.tempControlList', []);

    this.initOverapControlNode();

    this.findOverlapControlNode({
      nodeId: 'V_006',
    });
  }

  /**
   * @desc O.C
   * Overlap Control Storage List 초기화
   */
  initOverapControlNode() {
    // 노드 목록 중 장치만을 누적 제어 카운팅 목록으로 만듬

    // /** @type {csOverlapControlInfo[]} 실제 진행중인 누적 명령만을 가진 목록 */
    // this.processOverlapControlList = [];

    /** @type {csOverlapControlStorage[]} */
    this.overlapControlStorageList = _(this.nodeList)
      .filter(nodeInfo => _.eq(nodeInfo.is_sensor, 0))
      .map(nodeInfo => ({
        nodeInfo,
        overlapControlList: [],
      }))
      .value();
  }

  /**
   * @desc O.C
   * @param {csOverlapControlHandleConfig} node nodeId or nodeInfo 사용
   */
  findOverlapControlStorage(node) {
    // nodeId가 존재할 경우
    const { nodeId } = node;
    // nodeInfo 객체 자체를 넘겨 받을 경우
    let { nodeInfo } = node;
    if (_.isString(nodeId)) {
      const foundNodeInfo = _.find(this.nodeList, { node_id: nodeId });
      if (foundNodeInfo) {
        nodeInfo = foundNodeInfo;
      }
    }
    /** @type {csOverlapControlStorage} overlapControl 개체를 찾음 */
    const overlapControlStorage = _.find(this.overlapControlStorageList, { nodeInfo });

    return overlapControlStorage;
  }

  /**
   * @desc O.C
   * @param {csOverlapControlHandleConfig} findInfo OC 존재 체크 용 옵션
   * @return {csOverlapControlInfo}
   */
  findOverlapControlNode(findInfo) {
    const { singleControlType, controlSetValue } = findInfo;
    // nodeId가 존재할 경우
    const overlapControlStorage = this.findOverlapControlStorage(findInfo);

    // BU.CLI(overlapControlStorage);

    // OC 저장소가 존재하지 않는다면 종료
    if (_.isEmpty(overlapControlStorage)) return undefined;

    // 설정 제어 값이 있을 경우 where 조건 절 추가
    const overlapWhere = _.isEmpty(controlSetValue)
      ? { singleControlType }
      : { singleControlType, controlSetValue };

    // 찾는 조건에 부합하는 overlap Control을 찾음
    return _.find(overlapControlStorage.overlapControlList, overlapWhere);
  }

  /**
   * @desc O.C
   * Overlap Control 신규 추가
   * @param {csOverlapControlHandleConfig} addOcInfo OC 신규 생성 정보
   */
  createOverlapControlNode(addOcInfo) {
    // BU.CLI(addOcInfo);
    const { singleControlType, controlSetValue } = addOcInfo;
    const overlapControlStorage = this.findOverlapControlStorage(addOcInfo);

    // BU.CLI(overlapControlStorage);

    // OC 저장소가 존재하지 않는다면 종료
    if (_.isEmpty(overlapControlStorage)) return false;

    // OC 저장소가 존재한다면 OC가 존재하는지 체크
    const overlapControlInfo = this.findOverlapControlNode(addOcInfo);

    // BU.CLI(overlapControlInfo);

    // OC가 존재한다면 생성할 필요 없으므로 종료
    if (!_.isEmpty(overlapControlInfo)) return false;

    /** @type {csOverlapControlInfo} 새로이 생성할 제어 OC */
    const newOverlapControlInfo = {
      singleControlType,
      controlSetValue,
      overlapWCUs: [],
      overlapLockWCUs: [],
      reservedExecUU: '',
    };

    // 제어  OC 신규 생성 후 추가
    overlapControlStorage.overlapControlList.push(newOverlapControlInfo);

    return newOverlapControlInfo;
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
   * @desc O.C
   * 해당 장치에 대한 동일한 제어가 존재하는지 체크
   * @param {csOverlapControlHandleConfig} existControlInfo 누적 제어 조회 옵션
   * @return {boolean} 현재 값과 동일하거나 예약 명령이 존재할 경우 True, 아니라면 False
   */
  isExistSingleControl(existControlInfo) {
    // BU.CLI(existControlInfo);
    const { nodeId, singleControlType, controlSetValue } = existControlInfo;

    // 노드 Id가 동일한 노드 객체 가져옴
    const nodeInfo = _.find(this.nodeList, { node_id: nodeId });

    // 만약 노드 객체가 없다면 해당 노드에 관해서 명령 생성하지 않음.
    if (_.isEmpty(nodeInfo)) return true;

    // 설정 제어 값이 존재하고 현재 노드 값과 같다면 추가적으로 제어하지 않음
    // FIXME: ControlSetValue와 설정 제어 값을 치환할 경우 상이한 문제가 발생할 것으로 보임. 필요시 수정
    if (!_.isNil(controlSetValue) && _.eq(nodeInfo.data, controlSetValue)) return true;

    // 사용자가 알 수 있는 제어 구문으로 변경
    const cmdName = this.convertControlValueToString(nodeInfo, singleControlType);

    // node 현재 값과 동일하다면 제어 요청하지 않음
    if (_.isNil(controlSetValue) && _.eq(_.lowerCase(nodeInfo.data), _.lowerCase(cmdName))) {
      return true;
    }

    // 저장소가 존재한다면 OC가 존재하는지 체크
    const overlapControlInfo = this.findOverlapControlNode(existControlInfo);

    // BU.CLI(overlapControlInfo);

    // OC가 존재하지 않는다면 종료
    if (_.isEmpty(overlapControlInfo)) return false;

    // Wrap Command UUID가 지정되어 있다면 True, 아니라면 False
    return !!overlapControlInfo.reservedExecUU.length;
  }

  /**
   * @desc O.C
   * 생성된 명령의 누적 호출 목록을 추가한다.
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   */
  addOverlapControlCommand(complexCmdWrapInfo) {
    // BU.CLIN(complexCmdWrapInfo, 1);
    const { wrapCmdUUID, containerCmdList, realContainerCmdList } = complexCmdWrapInfo;

    // 수동 모드가 아닐 경우에만 요청 명령 Overlap overlapWCUs 반영
    if (this.controller.controlMode !== controlModeInfo.MANUAL) {
      this.updateContainerCommandOC({
        wrapCmdUUID,
        isRealCmd: false,
        containerCmdList,
      });
    }

    // 실제 명령 realContainerCmdList 저장 및 Overlap reservedExecUU 반영
    this.updateContainerCommandOC({
      wrapCmdUUID,
      isRealCmd: true,
      containerCmdList: realContainerCmdList,
    });

    // BU.CLI(this.overlapControlStorageList);
  }

  /**
   * @desc O.C
   * 복합 명령을 추가할 경우 실제 제어 여부에 따라서 WCU 및 ExecWCU를 정의함.
   * @param {Object} updateConfigOC
   * @param {string} updateConfigOC.wrapCmdUUID
   * @param {boolean} updateConfigOC.isRealCmd 실제 제어 명령 여부
   * @param {complexCmdContainerInfo[]} updateConfigOC.containerCmdList
   */
  updateContainerCommandOC(updateConfigOC) {
    const { wrapCmdUUID, isRealCmd, containerCmdList } = updateConfigOC;

    // 요청 명령 컨테이너 목록만큼 순회
    _.forEach(containerCmdList, containerCmdInfo => {
      const { singleControlType, controlSetValue, eleCmdList } = containerCmdInfo;

      // 세부 제어 명령 목록을 순회하면서 명령 호출 누적 처리
      _.forEach(eleCmdList, eleCmdInfo => {
        /** @type {csOverlapControlHandleConfig} */
        const overlapControlHandleConfig = {
          nodeId: eleCmdInfo.nodeId,
          singleControlType,
          controlSetValue,
        };
        let overlapControlNode = this.findOverlapControlNode(overlapControlHandleConfig);
        // BU.CLI(overlapControlNode);

        // 존재하지 않는다면 Overlap Control Node 생성
        if (!overlapControlNode) {
          overlapControlNode = this.createOverlapControlNode(overlapControlHandleConfig);
          // OC Storage가 없거나 OC가 존재하지 않으면 종료
          if (overlapControlNode === false) {
            throw new Error(
              `nodeId: ${
                eleCmdInfo.nodeId
              }, singleControlType: ${singleControlType} is not exist in OC Storage`,
            );
          }
        }

        if (isRealCmd) {
          // 실제 제어 WCU 지정
          overlapControlNode.reservedExecUU = eleCmdInfo.uuid;
        } else {
          // 누적 호출 카운팅
          overlapControlNode.overlapWCUs.push(wrapCmdUUID);
        }
      });
    });
  }

  /**
   * API 서버로 축약해서 명령을 보냄.
   */
  transmitComplexCommandStatus() {
    const contractCommandList = _(this.complexCmdList)
      .map(complexCmdInfo => _.pick(complexCmdInfo, complexCmdPickKey.FOR_SERVER))
      .value();

    // 업데이트 알림 (통째로 보내버림)
    this.controller.apiClient.transmitDataToServer({
      commandType: transmitToServerCommandType.COMMAND,
      data: contractCommandList,
    });
  }

  /**
   * Data logger와 연결되어 있는 컨트롤러를 반환
   * @param {dataLoggerInfo|string} searchValue string: dl_id, node_id or Object: DataLogger
   */
  findDataLoggerController(searchValue) {
    // BU.CLI(searchValue);
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
   * @param {DataLoggerControl} dataLoggerController Data Logger Controller 객체
   * @param {dcMessage} dcMessage 명령 수행 결과 데이터
   */
  manageComplexCommand(dataLoggerController, dcMessage) {
    const {
      COMMANDSET_EXECUTION_START,
      COMMANDSET_EXECUTION_TERMINATE,
      COMMANDSET_DELETE,
    } = dataLoggerController.definedCommandSetMessage;

    // BU.CLIN(dcMessage);

    // DLC commandId, commandType은 각각 wrapCmdId, wrapCmdType과 매칭됨
    const {
      commandSet: {
        commandId: dcWrapCmdId,
        commandType: dcWrapCmdType,
        wrapCmdUUID: dcWrapCmdUUID,
        uuid: dcCmdUUID,
      },
      msgCode: dcMsgCode,
    } = dcMessage;

    /** @type {complexCmdWrapInfo} */
    const foundComplexCmdInfo = _.find(this.complexCmdList, { wrapCmdUUID: dcWrapCmdUUID });

    // 통합 명령 UUID가 없을 경우
    if (!foundComplexCmdInfo) {
      throw new Error(`wrapCmdUUID: ${dcWrapCmdUUID} is not exist.`);
    }

    const {
      wrapCmdStep,
      wrapCmdId,
      wrapCmdName,
      wrapCmdType,
      containerCmdList,
      realContainerCmdList,
    } = foundComplexCmdInfo;

    // DC Message: COMMANDSET_EXECUTION_START && complexCmdStep !== WAIT ===> Change PROCEED Step
    // DCC 명령이 수행중
    if (_.eq(dcMsgCode, COMMANDSET_EXECUTION_START) && _.eq(wrapCmdStep, complexCmdStep.WAIT)) {
      foundComplexCmdInfo.wrapCmdStep = complexCmdStep.PROCEED;
      // 상태 변경된 명령 목록 API Server로 전송
      return this.transmitComplexCommandStatus();
    }

    // 명령 코드가 완료(COMMANDSET_EXECUTION_TERMINATE), 삭제(COMMANDSET_DELETE)가 아니라면 종료
    if (!_.includes([COMMANDSET_EXECUTION_TERMINATE, COMMANDSET_DELETE], dcMsgCode)) return false;

    // DLC에서 수신된 메시지가 명령 완료, 명령 삭제 완료 중 하나 일 경우
    // 실제 제어 컨테이너 안에 있는 Ele 요소 중 dcUUID와 동일한 개체 조회
    const allComplexEleCmdList = _(realContainerCmdList)
      .map('eleCmdList')
      .flatten()
      .value();

    // FIXME: Ele가 존재하지 않는다면 명령 삭제 처리 필요 (DCC Error 로 넘어가게됨.)
    if (!allComplexEleCmdList.length) {
      throw new Error(`wrapCmdId(${dcWrapCmdId}) does not exist in the Complex Command List.`);
    }

    // dcCmdUUID가 동일한 Complex Command를 찾음
    const foundEleInfo = _.find(allComplexEleCmdList, { uuid: dcCmdUUID });

    // Ele가 존재하지 않는다면 종료
    if (!foundEleInfo) {
      throw new Error(`dcCmdUUID(${dcCmdUUID}) does not exist in the Complex Command List.`);
    }

    // 해당 단위 명령 완료 처리
    foundEleInfo.hasComplete = true;

    // 계측 명령이 아닐 경우 OC 확인
    wrapCmdType !== reqWrapCmdType.MEASURE && this.completeUnitCommand(dcCmdUUID);

    // 모든 장치의 제어가 완료됐다면
    if (_.every(allComplexEleCmdList, 'hasComplete')) {
      BU.CLI(`M.UUID: ${this.controller.mainUUID || ''}`, `Complete CMD: ${wrapCmdId}`);

      // 명령 완료 처리
      this.completeComplexCommand(foundComplexCmdInfo);

      // FIXME: 수동 자동? 처리?
      // foundComplexCmdInfo.wrapCmdStep = complexCmdStep.RUNNING;
      // this.transmitComplexCommandStatus();

      if (wrapCmdId === 'inquiryAllDeviceStatus') {
        // BU.CLI('Comlete inquiryAllDeviceStatus');
        this.controller.emit('completeInquiryAllDeviceStatus', dcWrapCmdId);
        this.completeInquiryDeviceStatus();
      } else {
        // FIXME: 일반 명령 completeCommand이 완료되었을 경우 처리할 필요가 있다면 작성
        this.controller.emit('completeCommand', dcWrapCmdId);
      }
    }
  }

  /**
   * 단위 명령이 완료되었을 경우 장치 제어 추적 제거
   * @param {string} dcCmdUUID
   */
  completeUnitCommand(dcCmdUUID) {
    // 단위 명령 상 Data Logger Controller 에서
    const foundOverlapControlInfo = _(this.overlapControlStorageList)
      .map('overlapControlList')
      .flatten()
      .find({
        reservedExecUU: dcCmdUUID,
      });

    // BU.CLI(foundOverlapControlInfo);

    if (foundOverlapControlInfo) {
      foundOverlapControlInfo.reservedExecUU = '';
    }
    // BU.CLI(foundOverlapControlInfo);

    // _.find(this.overlapControlStorageList, ocStorage => {
    //   ocStorage.overlapControlList.forEach(ocControlInfo => {
    //     if (_.eq(ocControlInfo.reservedExecUU, dcCmdUUID)) {
    //       ocControlInfo.reservedExecUU = '';
    //     }
    //   });
    // });
  }

  /**
   * 명령이 완료되었을 경우 처리
   * @param {complexCmdWrapInfo} complexWrapCmdInfo
   * @param {boolean=} isAchieveCommandGoal 명령 목표치 달성 여부
   */
  completeComplexCommand(complexWrapCmdInfo, isAchieveCommandGoal) {
    // BU.CLI(this.findExistOverlapControl());
    // O.C reservedExecUU 제거
    // TODO: Prev.Single >> Curr.Single 명령 제거
    // TODO: Prev.Single >> !Curr.Single 명령 제거
    // TODO: !Prev.Single >> Curr.Single 명령 제거

    const { MANUAL } = controlModeInfo;

    const { MEASURE, CONTROL } = reqWrapCmdType;

    const { RUNNING } = complexCmdStep;

    let isDeleteCmd = true;

    const { controlMode, wrapCmdType, wrapCmdUUID } = complexWrapCmdInfo;

    // 제어 명령일 경우에만 RUNNING 여부 체크
    if (wrapCmdType === CONTROL) {
      // TODO: !Prev.Single >> !Curr.Single 명령 RUNNING 상태 변경
      if (controlMode !== MANUAL && this.controller.controlMode !== MANUAL) {
        complexWrapCmdInfo.wrapCmdStep = RUNNING;
        isDeleteCmd = false;
      }
    }

    // 명령 삭제 처리를 해야할 경우
    if (isDeleteCmd) {
      // wrapCmdUUID를 가진 O.C 제거
      _(this.overlapControlStorageList)
        .map('overlapControlList')
        .flatten()
        .forEach(overlapControlInfo => {
          _.pull(overlapControlInfo.overlapWCUs, wrapCmdUUID);
        });

      // Complex Command List 에서 제거
      _.remove(this.complexCmdList, { wrapCmdUUID });
    }

    this.transmitComplexCommandStatus();

    // OC 변경
    // FIXME: wrapCmdGoalInfo가 존재 할 경우 추가 논리
    // RUNNING 전환 시 limitTimeSec가 존재한다면 복구명령 setTimeout 생성
    // RUNNING 전환 시 goalDataList 존재한다면 추적 nodeList에 추가
  }

  /**
   * Overlap이 존재하는 목록을 불러옴
   * @return {csOverlapControlInfo[]}
   */
  findExistOverlapControl() {
    // BU.CLI(this.overlapControlStorageList);
    return _(this.overlapControlStorageList)
      .map(overlapStorage => {
        const {
          nodeInfo: { node_id: nodeId },
          overlapControlList,
        } = overlapStorage;

        const existOverlapControlList = [];

        _.forEach(overlapControlList, overlapControlInfo => {
          if (overlapControlInfo.overlapWCUs.length) {
            // BU.CLI(overlapControlInfo);
            existOverlapControlList.push(_.assign({ nodeId }, overlapControlInfo));
          }
        });
        return existOverlapControlList;
      })
      .flatten()
      .value();
  }

  /** 정기 계측 조회 명령 완료 결과 반영 */
  async completeInquiryDeviceStatus() {
    process.env.LOG_DBS_INQUIRY_COMPLETE === '1' &&
      BU.CLI(`${this.controller.mainUUID} Comlete inquiry`);

    // 정기 계측 카운팅 증가
    this.inquirySchedulerCurrCount += 1;

    // 정기 계측 저장 간격 수와 현재 수행된 정기 계측 명령 수가 같지 않다면 데이터 저장 X
    // 1분당 간격이 아닌 더 적은 인터벌 계측이 이루어 질 경우
    if (this.inquirySchedulerIntervalSaveCnt !== this.inquirySchedulerCurrCount) {
      return false;
    }

    // 현재 정기 계측된 카운팅 초기화
    this.inquirySchedulerCurrCount = 0;

    // 데이터의 유효성을 인정받는 Node List
    const validNodeList = this.checkValidateNodeData(
      this.nodeList,
      _.get(this, 'config.inquirySchedulerInfo.validInfo'),
      this.controller.inquirySchedulerRunMoment,
      // momentDate.format('YYYY-MM-DD HH:mm:ss'),
    );

    // BU.CLIN(validNodeList);
    process.env.LOG_DBS_INQUIRY_RESULT === '1' &&
      BU.CLI(this.getAllNodeStatus(nodePickKey.FOR_DATA));

    await this.insertNodeDataToDB(validNodeList, {
      hasSensor: process.env.DBS_SAVE_SENSOR !== '0',
      hasDevice: process.env.DBS_SAVE_DEVICE !== '0',
    });
  }

  /**
   * 명령상에 있는 장치 제어 중에 이상이 있는 장치 점검. 이상이 있을 경우 수행 불가
   * @param {complexCmdContainerInfo[]} containerCmdList
   */
  isNormalOperation(containerCmdList) {
    // 제어하고자 하는 모든 장치를 순회하며 이상 여부를 점검.
    return _.every(containerCmdList, containerCmdInfo => {
      const { eleCmdList } = containerCmdInfo;
      const result = _.every(eleCmdList, eleCmdInfo => {
        const foundDataLoggerController = this.findDataLoggerController(eleCmdInfo.nodeId);
        // 데이터로거가 존재하고 해당 데이터 로거가 에러 상태가 아닐 경우 True
        return _.isObject(foundDataLoggerController) && !foundDataLoggerController.isErrorDLC;
      });
      // BU.CLI(result);
      return result;
    });
  }

  /**
   * 복합 명령을 저장
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdWrapInfo}
   */
  saveComplexCommand(complexCmdWrapInfo) {
    BU.CLI('saveComplexCommand');
    const {
      wrapCmdType,
      wrapCmdId,
      wrapCmdGoalInfo: { goalDataList } = {},
      containerCmdList,
    } = complexCmdWrapInfo;

    const commandName = `wrapCmdId: ${wrapCmdId}, wrapCmdType: ${wrapCmdType}`;
    // ComplexCommandList에서 동일 Wrap Command Id 가 존재하는지 체크
    // BU.CLI(this.complexCmdList);
    if (_.find(this.complexCmdList, { wrapCmdType, wrapCmdId })) {
      throw new Error(`${commandName} is exist`);
    }

    // 수동 모드가 아닐 경우 명령 충돌 검사
    if (
      // FIXME: 개발테스트를 위하여 임시 주석
      // this.controller.controlMode !== controlMode.MANUAL &&
      this.isConflictCommand(containerCmdList)
    ) {
      throw new Error(`${commandName} conflict has occurred.`);
    }

    // wrapCmdGoalInfo.goalDataList가 존재 할 경우 현재 값과의 목표치 체크. 이미 달성하였다면 실행하지 않음.
    if (!_.isEmpty(goalDataList) && this.isAchieveCommandGoal(goalDataList)) {
      throw new Error(`${commandName} already achieved its goal.`);
    }

    // 계측 명령이라면 실제 제어목록 산출하지 않음
    if (wrapCmdType === reqWrapCmdType.MEASURE) {
      complexCmdWrapInfo.realContainerCmdList = containerCmdList;
    } else {
      // 제어하고자 하는 장치 중에 이상있는 장치 여부 검사
      if (!this.isNormalOperation(containerCmdList)) {
        throw new Error(`An abnormal device exists among the ${commandName}`);
      }
      const realContainerCmdList = this.produceRealControlCommand(containerCmdList);
      // 실제 명령이 존재하지 않을 경우 종료
      if (!realContainerCmdList.length) {
        throw new Error(`${commandName} real CMD list does not exist.`);
      }

      // 실제 수행하는 장치 제어 목록 정의
      complexCmdWrapInfo.realContainerCmdList = realContainerCmdList;

      // 복합 명령 csOverlapControlStorage 반영
      this.addOverlapControlCommand(complexCmdWrapInfo);
    }

    // BU.CLI(complexCmdWrapInfo);
    complexCmdWrapInfo.wrapCmdStep = complexCmdStep.WAIT;

    // 명령을 내릴 것이 없다면 등록하지 않음
    if (
      !_(complexCmdWrapInfo)
        .map('containerCmdList')
        .flatten()
        .value().length
    ) {
      return false;
    }

    // 명령을 요청한 시점에서의 제어 모드
    complexCmdWrapInfo.controlMode = this.controller.controlMode;

    this.complexCmdList.push(complexCmdWrapInfo);

    // BU.CLIN(this.complexCmdList, 4);

    // this.addOverlapControlNode({})

    this.transmitComplexCommandStatus();

    // BU.CLI(this.findExistOverlapControl());

    return complexCmdWrapInfo;
  }

  /**
   * 명령 스택을 고려하여 실제 내릴 명령을 산출
   * @param {complexCmdContainerInfo[]} containerCmdList 명령을 내릴 목록(여는 목록, 닫는 목록, ...)
   * @return {complexCmdContainerInfo[]} realContainerCmdList
   */
  produceRealControlCommand(containerCmdList) {
    // BU.CLI(containerCmdList);
    /** @type {complexCmdContainerInfo[]} 실제 명령을 내릴 목록 */
    const realContainerCmdList = [];

    // 각각의 제어 명령들의 존재 여부 체크. 없을 경우 추가
    _.forEach(containerCmdList, containerCmdInfo => {
      const { singleControlType, controlSetValue, eleCmdList } = containerCmdInfo;

      // 실제 제어 명령 목록 산출
      const realEleCmdList = _.filter(
        eleCmdList,
        eleCmdInfo =>
          // 존재하지 않을 경우 true
          !this.isExistSingleControl({
            nodeId: eleCmdInfo.nodeId,
            singleControlType,
            controlSetValue,
          }),
      );

      // 실제 제어 목록이 존재한다면 삽입
      if (realEleCmdList.length) {
        realContainerCmdList.push({
          singleControlType,
          controlSetValue,
          eleCmdList: realEleCmdList,
        });
      }
    });
    return realContainerCmdList;
  }

  /**
   * 명령 목표치 달성 여부 체크
   * @param {Object[]} cmdGoalDataList 해당 명령을 통해 얻고자 하는 값 목록
   * @param {string} cmdGoalDataList.nodeId 달성하고자 하는 nodeId
   * @param {string|number} cmdGoalDataList.goalValue 달성 기준치 값
   * @param {number} cmdGoalDataList.goalRange 기준치 인정 범위.
   * @return {boolean}
   */
  isAchieveCommandGoal(cmdGoalDataList) {
    // 목표치 설정 기준치
    const { EQUAL, LOWER, UPPER } = goalDataRange;
    // 모든 장치에 대한 목표치 조건에 부합한다면 True
    return _.every(cmdGoalDataList, cmdGoalInfo => {
      // 각각의 명령 목표 조건 옵션
      const { nodeId, goalValue, goalRange } = cmdGoalInfo;
      // 해당 노드가 존재하는지 체크
      const nodeInfo = _.find(this.nodeList, { node_id: nodeId });
      // 노드가 존재하지 않거나 데이터가 존재하지 않을 경우 종료
      if (!nodeInfo || _.isEmpty(nodeInfo.data)) return false;

      let verify = false;
      // 목표 달성 기준 조건 체크
      switch (goalRange) {
        case EQUAL:
          verify = _.eq(goalValue, nodeInfo.data);
          break;
        case LOWER:
          verify = goalValue < nodeInfo.data;
          break;
        case UPPER:
          verify = goalValue > nodeInfo.data;
          break;
        default:
          break;
      }
      return verify;
    });
  }

  /**
   * 명령 충돌 체크
   * @param {complexCmdContainerInfo[]} containerCmdList Complex Command Container List
   * @return {boolean}
   */
  isConflictCommand(containerCmdList) {}

  /**
   * 모든 노드가 가지고 있는 정보 출력
   * @param {nodePickKey} nodePickKeyList
   * @param {nodeInfo[]=} nodeList
   * @param {number[]=} targetSensorRange 보내고자 하는 센서 범위를 결정하고 필요 데이터만을 정리하여 반환
   */
  getAllNodeStatus(nodePickKeyList = nodePickKey.FOR_SERVER, nodeList = this.nodeList) {
    const orderKey = _.includes(nodePickKeyList, 'node_id') ? 'node_id' : _.head(nodePickKeyList);

    const statusList = _(nodeList)
      .map(nodeInfo => {
        if (nodePickKeyList) {
          return _.pick(nodeInfo, nodePickKeyList);
        }
        return nodeInfo;
      })
      .orderBy(orderKey)
      .value();
    // BU.CLI(statusList);
    return statusList;
  }

  /**
   * 노드 리스트 중 입력된 날짜를 기준으로 유효성을 가진 데이터만 반환
   * @param {nodeInfo[]} nodeList
   * @param {timeIntervalToValidateInfo} diffInfo
   * @param {moment.Moment} momentDate
   * @return {nodeInfo[]}
   */
  checkValidateNodeData(
    nodeList,
    diffInfo = { diffType: 'minutes', duration: 1 },
    momentDate = moment(),
  ) {
    // 입력된 노드 리스트를 돌면서 유효성 검증
    return nodeList.filter(nodeInfo => {
      // 날짜 차 계산
      const diffNum = momentDate.diff(moment(nodeInfo.writeDate), diffInfo.diffType);
      // 날짜 차가 허용 범위를 넘어섰다면 유효하지 않는 데이터
      if (diffNum > diffInfo.duration) {
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
  async insertNodeDataToDB(nodeList, insertOption = { hasSensor: false, hasDevice: false }) {
    const { DEVICE, SENSOR } = nodeDataType;
    const { FOR_DB } = nodePickKey;
    const returnValue = [];
    try {
      if (insertOption.hasSensor) {
        const nodeSensorList = _(nodeList)
          .filter(ele => ele.save_db_type === SENSOR && _.isNumber(ele.data))
          .map(ele => BU.renameObj(_.pick(ele, FOR_DB), 'data', 'num_data'))
          .value();
        // BU.CLI(nodeSensorList);
        const result = await this.biModule.setTables('dv_sensor_data', nodeSensorList, false);
        returnValue.push(result);
      }

      // 장치류 삽입
      if (insertOption.hasDevice) {
        const nodeDeviceList = _(nodeList)
          .filter(ele => ele.save_db_type === DEVICE && _.isString(ele.data))
          .map(ele => BU.renameObj(_.pick(ele, FOR_DB), 'data', 'str_data'))
          .value();

        // BU.CLI(nodeDeviceList);
        const result = await this.biModule.setTables('dv_device_data', nodeDeviceList, false);
        returnValue.push(result);
      }
    } catch (error) {
      BU.errorLog('insertNodeDataToDB', error);
      return returnValue;
    }

    // BU.CLIN(nodeList);
    // BU.CLIS(insertOption, insertOption.hasSensor, insertOption.hasDevice);
    // 센서류 삽입
    return returnValue;
  }
}
module.exports = Model;
