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

class ManualCmdManager extends AbstCmdManager {
  /** @param {MainControl} controller */
  constructor(controller) {
    super(controller);

    // 컨트롤러 제어 모드 변경
    controller.controlMode = controlModeInfo.MANUAL;

    this.controlMode = controlModeInfo.MANUAL;
  }

  /**
   * @implements
   * 현재 값과 틀리거나 장치 제어 예약이 없는 경우 실제 제어 목록으로 산출
   * @param {complexCmdWrapInfo} complexCmdWrapInfo
   * @return {complexCmdContainerInfo[]} realContainerCmdList
   */
  produceRealControlCommand(complexCmdWrapInfo) {
    BU.CLI('produceRealControlCommand');
    const { controlMode, wrapCmdType, containerCmdList } = complexCmdWrapInfo;

    /** @type {complexCmdContainerInfo[]} 실제 명령을 내릴 목록 */
    const realContainerCmdList = [];

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
    const deviceData = this.convertControlValueToString(nodeInfo, singleControlType);

    // node 현재 값과 동일하다면 제어 요청하지 않음
    if (_.isNil(controlSetValue) && _.eq(_.lowerCase(nodeInfo.data), _.lowerCase(deviceData))) {
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
module.exports = ManualCmdManager;
