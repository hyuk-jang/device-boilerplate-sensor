const _ = require('lodash');
const { BU } = require('base-util-jh');

const AbstCmdManager = require('./AbstCmdManager');

const { dcmWsModel, dcmConfigModel } = require('../../../default-intelligence');

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

class AutoCmdManager extends AbstCmdManager {
  /** @param {MainControl} controller */
  constructor(controller) {
    super(controller);

    // 컨트롤러 제어 모드 변경
    controller.controlMode = controlModeInfo.AUTOMATIC;
  }

  /**
   * @abstract
   * 각 제어 모드 별로 체크하고자 하는 내용 체크
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {boolean} 충돌 true, 아닐 경우 false
   */
  checkSaveComplexCommand(complexCmdWrapInfo) {
    try {
      const { wrapCmdType } = complexCmdWrapInfo;
      // 제어 요청일 경우에 충돌 체크
      if (wrapCmdType === reqWrapCmdType.CONTROL) {
        // 명령 충돌 체크
        return this.isConflictCommand(complexCmdWrapInfo);
      }
      return false;
    } catch (error) {
      throw error;
    }
  }

  /**
   * @implements
   * O.C 누적 카운팅 상태가 변하거나 현재 장치 값이 틀릴 경우 실제 제어 목록으로 산출
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdContainerInfo[]} realContainerCmdList
   */
  produceRealControlCommand(complexCmdWrapInfo) {
    // BU.CLI('produceRealControlCommand');

    const { controlMode, wrapCmdType, wrapCmdId, containerCmdList } = complexCmdWrapInfo;

    /** @type {complexCmdContainerInfo[]} 실제 명령을 내릴 목록 */
    let realContainerCmdList = [];

    switch (wrapCmdType) {
      // 제어 요청일 경우 실제 제어 목록 반환
      case reqWrapCmdType.CONTROL:
        realContainerCmdList = this.produceControlCommand(complexCmdWrapInfo);
        break;
      // 제어 요청일 경우 실제 제어 목록 반환
      case reqWrapCmdType.CANCEL:
        realContainerCmdList = this.produceCancelCommand(complexCmdWrapInfo);
        break;

      default:
        break;
    }

    return realContainerCmdList;
  }

  /**
   * 제어할 경우
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdContainerInfo[]} realContainerCmdList
   */
  produceControlCommand(complexCmdWrapInfo) {
    // BU.CLI(complexCmdWrapInfo);9
    const { controlMode, wrapCmdType, wrapCmdId, containerCmdList } = complexCmdWrapInfo;

    /** @type {complexCmdContainerInfo[]} 실제 명령을 내릴 목록 */
    const realContainerCmdList = [];

    // 명령 컨테이너를 순회
    _.forEach(containerCmdList, containerCmdInfo => {
      const { singleControlType, controlSetValue, eleCmdList } = containerCmdInfo;

      // 각 노드들을 확인
      const realEleCmdList = _.filter(eleCmdList, eleCmdInfo => {
        const { nodeId } = eleCmdInfo;

        // 노드 정보를 불러옴
        const nodeInfo = _.find(this.nodeList, { node_id: nodeId });
        // BU.CLI(nodeInfo);
        /** @type {csOverlapControlHandleConfig} */
        const overlapControlHandleConfig = {
          nodeId: eleCmdInfo.nodeId,
          singleControlType,
          controlSetValue,
        };

        // Overlap Control 조회
        let overlapControlNode = this.findOverlapControlNode(overlapControlHandleConfig);

        // overlapWCUs.length 가 존재하지만 reservedExecUU가 없고 제어 장치값이 다를 경우 추가로 제어구문 생성하고 reservedExecUU가 반영

        // OC 가 없다면 신규 OC. 새로 생성 함.
        if (_.isEmpty(overlapControlNode)) {
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

        // 이미 제어하는 명령이 존재한다면 추가하지 않음
        if (overlapControlNode.reservedExecUU.length) {
          return false;
        }

        // 제어하고자 하는 데이터 값
        const strNodeData = _.lowerCase(
          this.convertControlValueToString(nodeInfo, singleControlType),
        );

        // 제어 변동은 없으나 현 상태 값과 틀리는 장치가 발견될 경우 제어 추가
        if (!_.isNil(nodeInfo.data) && !_.eq(strNodeData, _.lowerCase(nodeInfo.data))) {
          return true;
        }
      });

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
   * 취소할 경우
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdContainerInfo[]} realContainerCmdList
   */
  produceCancelCommand(complexCmdWrapInfo) {
    // TODO: 실행 중인 Wrap Command 를 가져옴

    // TODO: Wrap Command Step이 RUNNING이 아니라면 DCC 명령 이동, 명령 삭제

    // TODO: 명령 삭제 처리 후 Real Control 목록 산출

    // TODO: OC 계산 후 제어 변동 시 실제 제어 장치 추가
    // BU.CLI(complexCmdWrapInfo);
    const { controlMode, wrapCmdType, wrapCmdId, containerCmdList } = complexCmdWrapInfo;

    /** @type {complexCmdContainerInfo[]} 실제 명령을 내릴 목록 */
    const realContainerCmdList = [];

    // 명령 컨테이너를 순회
    _.forEach(containerCmdList, containerCmdInfo => {
      const { singleControlType, controlSetValue, eleCmdList } = containerCmdInfo;

      // 각 노드들을 확인
      const realEleCmdList = _.filter(eleCmdList, eleCmdInfo => {
        const { nodeId } = eleCmdInfo;

        // 노드 정보를 불러옴
        const nodeInfo = _.find(this.nodeList, { node_id: nodeId });
        // BU.CLI(nodeInfo);
        /** @type {csOverlapControlHandleConfig} */
        const overlapControlHandleConfig = {
          nodeId: eleCmdInfo.nodeId,
          singleControlType,
          controlSetValue,
        };

        // Overlap Control 조회
        let overlapControlNode = this.findOverlapControlNode(overlapControlHandleConfig);

        // overlapWCUs.length 가 존재하지만 reservedExecUU가 없고 제어 장치값이 다를 경우 추가로 제어구문 생성하고 reservedExecUU가 반영

        // OC 가 없다면 신규 OC. 새로 생성 함.
        if (_.isEmpty(overlapControlNode)) {
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

        // 이미 제어하는 명령이 존재한다면 추가하지 않음
        if (overlapControlNode.reservedExecUU.length) {
          return false;
        }

        // 제어하고자 하는 데이터 값
        const strNodeData = _.lowerCase(
          this.convertControlValueToString(nodeInfo, singleControlType),
        );

        // 제어 변동은 없으나 현 상태 값과 틀리는 장치가 발견될 경우 제어 추가
        if (!_.isNil(nodeInfo.data) && !_.eq(strNodeData, _.lowerCase(nodeInfo.data))) {
          return true;
        }
      });

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
   * FIXME: TEMP
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

    // OC가 존재하지 않는다면 실행 중이지 않음
    if (_.isEmpty(overlapControlInfo)) return false;

    // Wrap Command UUID가 지정되어 있다면 True, 아니라면 False
    return !!overlapControlInfo.reservedExecUU.length;
  }
}
module.exports = AutoCmdManager;
