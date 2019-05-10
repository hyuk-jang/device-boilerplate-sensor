const _ = require('lodash');
const { BU } = require('base-util-jh');

const { dcmWsModel, dcmConfigModel } = require('../../../default-intelligence');

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

class AbstCmdManager {
  /** @param {MainControl} controller */
  constructor(controller) {
    this.controller = controller;

    const { model, nodeList } = this.controller;
    const { complexCmdList, overlapControlStorageList, mapCmdInfo } = model;

    this.nodeList = nodeList;

    this.model = model;

    this.complexCmdList = complexCmdList;
    this.overlapControlStorageList = overlapControlStorageList;

    this.mapCmdInfo = mapCmdInfo;
  }

  /**
   * FIXME: TEMP
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
   *
   * @param {Object} reqFlowCmd
   * @param {string=} reqFlowCmd.srcPlaceId 시작 장소 ID
   * @param {string=} reqFlowCmd.destPlaceId 목적지 장소 Id
   * @param {string=} reqFlowCmd.cmdId 명령 이름 영어(srcPlaceId_TO_destPlaceId)
   * @return {flowCmdDestInfo} 데이터를 찾을 경우. 아니라면 undefined
   */
  findFlowCommand(reqFlowCmd) {
    const { cmdId = '', srcPlaceId = '', destPlaceId = '' } = reqFlowCmd;
    // 명령 Full ID로 찾고자 할 경우
    if (cmdId.length) {
      return _(this.mapCmdInfo.flowCmdList)
        .map('destList')
        .flatten()
        .find({ cmdId });
    }

    // 시작지와 목적지가 있을 경우
    if (srcPlaceId.length && destPlaceId.length) {
      const flowCmdInfo = _.find(this.mapCmdInfo.flowCmdList, { srcPlaceId });
      if (flowCmdInfo !== undefined) {
        return _.find(flowCmdInfo.destList, { destPlaceId });
      }
    }
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

      // 요청한 명령이 현재 모드에서 실행 가능한지 체크
      this.checkSaveComplexCommand(complexCmdWrapInfo);

      // 계측 명령이라면 실제 제어목록 산출하지 않음
      if (wrapCmdType === reqWrapCmdType.MEASURE) {
        complexCmdWrapInfo.realContainerCmdList = containerCmdList;
      } else {
        // 제어하고자 하는 장치 중에 이상있는 장치 여부 검사
        if (!this.isNormalOperation(containerCmdList)) {
          throw new Error(`An abnormal device exists among the ${cmdName}`);
        }
        // 실제 제어할 명령 리스트 산출
        // BU.CLI(containerCmdList);

        const realContainerCmdList = this.produceRealControlCommand(complexCmdWrapInfo);

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
        this.addOverlapControlCommand(complexCmdWrapInfo);
      }

      complexCmdWrapInfo.wrapCmdStep = complexCmdStep.WAIT;
      BU.CLI('@@@@@@');
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

      return complexCmdWrapInfo;
    } catch (error) {
      throw error;
    }
  }

  /**
   * @abstract
   * 각 제어 모드 별로 체크하고자 하는 내용 체크
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   */
  checkSaveComplexCommand(complexCmdWrapInfo) {
    return false;
  }

  /**
   * @interface
   * 명령 스택을 고려하여 실제 내릴 명령을 산출
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdContainerInfo[]} realContainerCmdList
   */
  produceRealControlCommand(complexCmdWrapInfo) {}

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
   * 저장소 데이터 관리. Data Logger Controller 객체로 부터 Message를 받은 경우 msgCode에 따라서 관리
   * @example
   * Device Client로부터 Message 수신
   * @param {DataLoggerControl} dataLoggerController Data Logger Controller 객체
   * @param {dcMessage} dcMessage 명령 수행 결과 데이터
   */
  manageComplexCommand(dataLoggerController, dcMessage) {}

  /**
   * 명령이 완료되었을 경우 처리
   * @param {complexCmdWrapInfo} complexWrapCmdInfo
   * @param {boolean=} isAchieveCommandGoal 명령 목표치 달성 여부
   */
  completeComplexCommand(complexWrapCmdInfo, isAchieveCommandGoal) {}

  /**
   * 단위 명령이 완료되었을 경우 장치 제어 추적 제거
   * @param {string} dcCmdUUID
   */
  completeUnitCommand(dcCmdUUID) {}

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
module.exports = AbstCmdManager;
