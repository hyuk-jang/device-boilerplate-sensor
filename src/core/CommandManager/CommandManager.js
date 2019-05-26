const _ = require('lodash');
const { BU } = require('base-util-jh');

const CmdStrategySetter = require('./CmdStrategySetter');

const { dcmWsModel, dcmConfigModel } = require('../../../../default-intelligence');

const {
  complexCmdStep,
  nodePickKey,
  complexCmdPickKey,
  controlModeInfo,
  goalDataRange,
  nodeDataType,
  reqWrapCmdType,
  reqDeviceControlType,
} = dcmConfigModel;

class CommandManager {
  /** @param {Model} model */
  constructor(model) {
    const { controller, complexCmdList, overlapControlStorageList, mapCmdInfo, nodeList } = model;

    this.model = model;
    this.controller = controller;

    this.nodeList = nodeList;

    this.complexCmdList = complexCmdList;
    this.overlapControlStorageList = overlapControlStorageList;

    this.mapCmdInfo = mapCmdInfo;

    // 명령 전략가 등록
    this.cmdStrategy;
  }

  init() {
    // 기본 제공되는 명령 전략 세터를 등록한다. 프로젝트에 따라 Bridge 패턴으로 setCommandStrategy에 재정의 한다.
    this.cmdStrategySetter = new CmdStrategySetter(this);
    // 제어 모드가 변경될 경우 수신 받을 옵저버 추가
    this.controller.controlModeUpdator.attachObserver(this);
  }

  /**
   * cmdSetter를 교체할 경우
   * @param {CmdSetter} cmdSetter
   */
  setCmdSetter(cmdSetter) {
    this.cmdStrategySetter = cmdSetter;
  }

  /**
   * 제어모드가 변경되었을 경우 값에 따라 Command Manager를 교체
   * @param {number} controlMode 제어모드
   */
  updateControlMode(controlMode) {
    this.cmdStrategySetter.updateControlMode(controlMode);
  }

  /**
   * 명령 전략을 교체할 경우
   * @description Bridge Pattern
   * @param {CmdStrategy} cmdStrategy
   */
  setCommandStrategy(cmdStrategy) {
    this.cmdStrategy = cmdStrategy;
  }

  /**
   * @param {nodeInfo} nodeInfo
   * @param {string} singleControlType
   */
  convertControlValueToString(nodeInfo, singleControlType) {
    return this.cmdStrategy.convertControlValueToString(nodeInfo, singleControlType);
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
   * @return {csOverlapControlInfo} 없을 경우 undefined 반환
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
   * @desc O.C
   * 생성된 명령의 누적 호출 목록을 추가한다.
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   */
  updateOverlapControlCommand(complexCmdWrapInfo) {
    // BU.CLIN(complexCmdWrapInfo, 1);
    const {
      wrapCmdId,
      wrapCmdUUID,
      wrapCmdType,
      containerCmdList,
      realContainerCmdList,
    } = complexCmdWrapInfo;

    // 명령 취소일 경우 누적 카운팅 제거
    if (wrapCmdType === reqWrapCmdType.CANCEL) {
      // 실행 중인 Wrap Command 를 가져옴
      const runningWrapCmdInfo = _.find(this.complexCmdList, { wrapCmdId });

      // wrapCmdUUID를 가진 O.C 제거
      _(this.overlapControlStorageList)
        .map('overlapControlList')
        .flatten()
        .forEach(overlapControlInfo => {
          _.pull(overlapControlInfo.overlapWCUs, runningWrapCmdInfo.wrapCmdUUID);
        });
    }
    // 수동 모드가 아닐 경우에만 요청 명령 Overlap overlapWCUs 반영
    else if (this.controller.controlModeUpdator.controlMode !== controlModeInfo.MANUAL) {
      this.updateContainerCommandOC({
        wrapCmdType,
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
   * @interface
   * 명령 스택을 고려하여 실제 내릴 명령을 산출
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdContainerInfo[]} realContainerCmdList
   */
  produceRealControlCommand(complexCmdWrapInfo) {}

  /**
   * 복합 명령을 저장
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdWrapInfo}
   */
  saveComplexCommand(complexCmdWrapInfo) {
    try {
      const {
        wrapCmdType,
        wrapCmdId,
        wrapCmdGoalInfo: { goalDataList } = {},
        containerCmdList,
      } = complexCmdWrapInfo;

      // BU.CLI(complexCmdWrapInfo);

      const cmdName = `wrapCmdId: ${wrapCmdId}, wrapCmdType: ${wrapCmdType}`;
      // ComplexCommandList에서 동일 Wrap Command Id 가 존재하는지 체크
      // BU.CLI(this.complexCmdList);
      if (_.find(this.complexCmdList, { wrapCmdType, wrapCmdId })) {
        throw new Error(`${cmdName} is exist`);
      }

      // 요청한 명령이 현재 모드에서 실행 가능한지 체크. 처리가 불가능 하다면 예외 발생
      this.cmdStrategy.isPossibleSaveComplexCommand(complexCmdWrapInfo);

      // 계측 명령이라면 실제 제어목록 산출하지 않음
      if (wrapCmdType === reqWrapCmdType.MEASURE) {
        complexCmdWrapInfo.realContainerCmdList = containerCmdList;
      } else {
        // 제어하고자 하는 장치 중에 이상있는 장치 여부 검사
        if (!this.isNormalOperation(containerCmdList)) {
          throw new Error(`An abnormal device exists among the ${cmdName}`);
        }

        // 실제 제어할 명령 리스트 산출
        const realContainerCmdList = this.cmdStrategy.produceRealControlCommand(complexCmdWrapInfo);

        // BU.CLI(realContainerCmdList);

        // if (wrapCmdType === reqWrapCmdType.RESTORE) {
        //   BU.CLI(realContainerCmdList);
        // }
        // 실제 명령이 존재하지 않을 경우 종료
        if (!realContainerCmdList.length) {
          throw new Error(`${cmdName} real CMD list does not exist.`);
        }

        // 실제 수행하는 장치 제어 목록 정의
        complexCmdWrapInfo.realContainerCmdList = realContainerCmdList;

        // 복합 명령 csOverlapControlStorage 반영
        this.updateOverlapControlCommand(complexCmdWrapInfo);
      }

      complexCmdWrapInfo.wrapCmdStep = complexCmdStep.WAIT;

      // 명령 취소가 요청이 정상적으로 처리되었다면 기존 제어 명령은 제거 처리
      if (wrapCmdType === reqWrapCmdType.CANCEL) {
        // 명령이 존재하는 index 조회
        const foundIndex = _.findIndex(this.complexCmdList, {
          wrapCmdId,
          wrapCmdType: reqWrapCmdType.CONTROL,
        });

        // 만약 CC가 존재한다면 제거
        this.model.criticalManager.removeCriticalCommand(this.complexCmdList[foundIndex]);
        // 기존 복합 명령 제거
        _.pullAt(this.complexCmdList, [foundIndex]);
        // _.remove(this.complexCmdList, { wrapCmdId, wrapCmdType: reqWrapCmdType.CONTROL });
      }

      // 명령을 요청한 시점에서의 제어 모드
      complexCmdWrapInfo.controlMode = this.controller.controlModeUpdator.controlMode;

      this.complexCmdList.push(complexCmdWrapInfo);

      // 명령 스택이 정상적으로 처리되었으므로 API Client에게 전송
      this.model.transmitComplexCommandStatus();

      return complexCmdWrapInfo;
    } catch (error) {
      throw error;
    }
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
      // BU.CLI(this.complexCmdList);
      throw new Error(`wrapCmdUUID: ${dcWrapCmdUUID} is not exist.`);
    }

    const {
      wrapCmdStep,
      wrapCmdId,
      wrapCmdName,
      wrapCmdType,
      wrapCmdGoalInfo,
      containerCmdList,
      realContainerCmdList,
    } = foundComplexCmdInfo;

    // DC Message: COMMANDSET_EXECUTION_START && complexCmdStep !== WAIT ===> Change PROCEED Step
    // DCC 명령이 수행중
    if (_.eq(dcMsgCode, COMMANDSET_EXECUTION_START) && _.eq(wrapCmdStep, complexCmdStep.WAIT)) {
      foundComplexCmdInfo.wrapCmdStep = complexCmdStep.PROCEED;
      // 상태 변경된 명령 목록 API Server로 전송
      return this.model.transmitComplexCommandStatus();
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
      BU.log(`M.UUID: ${this.controller.mainUUID || ''}`, `Complete: ${wrapCmdId} ${wrapCmdType}`);

      // 명령 완료 처리
      this.cmdStrategy.completeComplexCommand(foundComplexCmdInfo);

      // FIXME: 수동 자동? 처리?
      // foundComplexCmdInfo.wrapCmdStep = complexCmdStep.RUNNING;
      // this.transmitComplexCommandStatus();

      if (wrapCmdId === 'inquiryAllDeviceStatus') {
        // BU.CLI('Comlete inquiryAllDeviceStatus');
        this.controller.emit('completeInquiryAllDeviceStatus', dcWrapCmdId);
        this.model.completeInquiryDeviceStatus();
      } else {
        // FIXME: 일반 명령 completeCommand이 완료되었을 경우 처리할 필요가 있다면 작성
        this.controller.emit('completeCommand', dcWrapCmdUUID);
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
   * 명령상에 있는 장치 제어 중에 이상이 있는 장치 점검. 이상이 있을 경우 수행 불가
   * @param {complexCmdContainerInfo[]} containerCmdList
   */
  isNormalOperation(containerCmdList) {
    // 제어하고자 하는 모든 장치를 순회하며 이상 여부를 점검.
    return _.every(containerCmdList, containerCmdInfo => {
      const { eleCmdList } = containerCmdInfo;
      const result = _.every(eleCmdList, eleCmdInfo => {
        const foundDataLoggerController = this.model.findDataLoggerController(eleCmdInfo.nodeId);
        // 데이터로거가 존재하고 해당 데이터 로거가 에러 상태가 아닐 경우 True
        return _.isObject(foundDataLoggerController) && !foundDataLoggerController.isErrorDLC;
      });
      // BU.CLI(result);
      return result;
    });
  }

  /**
   * 명령 목표치 달성 여부 체크
   * @param {Object[]} cmdGoalDataList 해당 명령을 통해 얻고자 하는 값 목록
   * @param {string} cmdGoalDataList.nodeId 달성하고자 하는 nodeId
   * @param {string|number} cmdGoalDataList.goalValue 달성 기준치 값
   * @param {number} cmdGoalDataList.goalRange 기준치 인정 범위.
   * @return {boolean}
   */
  isAchieveCommandGoal(cmdGoalDataList) {}

  /**
   * 명령 충돌 체크
   * @param {complexCmdWrapInfo} complexCmdWrapInfo 복합 명령 객체
   * @return {boolean}
   */
  isConflictCommand(complexCmdWrapInfo) {
    // BU.CLI(complexCmdWrapInfo);
    try {
      const { wrapCmdId, containerCmdList } = complexCmdWrapInfo;
      // 각각의 제어 명령들의 존재 여부 체크. 없을 경우 추가
      _.forEach(containerCmdList, containerCmdInfo => {
        const { singleControlType, controlSetValue, eleCmdList } = containerCmdInfo;

        // 각 노드들을 확인
        _.forEach(eleCmdList, eleCmdInfo => {
          const { nodeId } = eleCmdInfo;

          const nodeInfo = _.find(this.nodeList, { node_id: nodeId });
          // BU.CLI(nodeInfo);

          /** @type {csOverlapControlStorage} */
          const ocStorageInfo = _.find(this.overlapControlStorageList, { nodeInfo });
          // BU.CLI(nodeId, ocStorageInfo);

          // 제어하고자 하는 방향에 위배되는지 체크
          const conflictWCUs = _(ocStorageInfo.overlapControlList)
            .reject({
              singleControlType,
              controlSetValue,
            })
            .map('overlapWCUs')
            .flatten()
            .value();

          // if (wrapCmdId === 'SEB_1_A_TO_BW_1') {
          //   BU.CLI(nodeId, conflictWCUs);
          // }

          if (conflictWCUs.length) {
            throw new Error(`A node(${nodeId}) in wrapCmd(${wrapCmdId}) has conflict.`);
          }
        });
      });
      return false;
    } catch (error) {
      throw error;
    }
  }
}
module.exports = CommandManager;
