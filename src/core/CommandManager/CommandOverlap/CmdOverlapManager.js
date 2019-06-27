const _ = require('lodash');

const { BU } = require('base-util-jh');

const CmdOverlapComponent = require('./CmdOverlapComponent');
const CmdOverlapStorage = require('./CmdOverlapStorage');
const CmdOverlapStatus = require('./CmdOverlapStatus');

const {
  dcmConfigModel: { reqWrapCmdType },
} = require('../../CoreFacade');

class CmdOverlapManager extends CmdOverlapComponent {
  /** @param {CommandManager} cmdManager */
  constructor(cmdManager) {
    super();
    this.cmdManager = cmdManager;

    /**
     * 명령 추적을 위한 Overlap Control Storage List 초기화.
     * @type {CmdOverlapStorage[]}
     */
    this.cmdOverlapStorageList = cmdManager.nodeList
      // 센서는 추적 대상에서 제외
      .filter(nodeInfo => _.eq(nodeInfo.is_sensor, 0))
      .map(nodeInfo => new CmdOverlapStorage(nodeInfo));
  }

  /**
   * Overlap이 존재하는 목록을 불러옴
   * @param {number=} singleConType 0(False), 1(True), 2(Measure), 3(Set)
   */
  getExistOverlapStatusList(singleConType) {
    return this.cmdOverlapStorageList
      .map(storageInfo => {
        return storageInfo.getExistWcuListExceptOption(singleConType);
      })
      .filter(result => !_.isEmpty(result));
  }

  /**
   * Overlap이 존재하는 목록을 불러옴
   * @param {number=} singleConType 0(False), 1(True), 2(Measure), 3(Set)
   * @param {number|string=} conSetValue singleControType이 3(Set) 일 경우 설정 값
   */
  getExistSimpleOverlapList(singleConType, conSetValue) {
    const result = [];

    // singleConType이 존재하지 않는다면 빈 배열 반환
    if (_.isNil(singleConType)) return result;

    _.forEach(this.cmdOverlapStorageList, overlapStorage => {
      const overlapStatus = overlapStorage.getOverlapStatus(singleConType, conSetValue);
      if (overlapStatus.getOverlapWCUs().length) {
        result.push({
          nodeId: overlapStorage.nodeId,
          singleControlType: overlapStatus.getSingleControlType(),
          controlSetValue: overlapStatus.getControlSetValue(),
          overlapWCUs: overlapStatus.getOverlapWCUs(),
          reservedECU: overlapStatus.getReservedECU(),
        });
      }
    });

    return result;
  }

  /**
   * 해당 노드 정보를 가진 명령 누적 저장소를 호출
   * @param {string} nodeId Node ID or nodeInfo 객체
   */
  getOverlapStorage(nodeId) {
    return _.find(this.cmdOverlapStorageList, { nodeId });
  }

  /**
   * @override 인자값을 3개 받는 형식으로 바꿈.
   * @param {string} nodeId Node ID or nodeInfo 객체
   * @param {number} singleControlType Device Protocol Converter에 요청할 명령에 대한 인자값 1: Open, On, ... ::: 0: Close, Off, undefind: Status
   * @param {*=} controlSetValue singleControlType 가 SET(3)일 경우 설정하는 값
   * @return {CmdOverlapStatus}
   */
  getOverlapStatus(nodeId, singleControlType, controlSetValue) {
    try {
      return this.getOverlapStorage(nodeId).getOverlapStatus(singleControlType, controlSetValue);
    } catch (error) {
      throw error;
    }
  }

  /**
   * @desc CmdOverlapStorage
   * 단위명령을 가진 Status 객체 조회
   * @param {string} reservedECU
   * @return {CmdOverlapStatus[]}
   */
  getOverlapStatusWithECU(reservedECU) {
    return _.flatten(
      this.cmdOverlapStorageList.map(overlapStorage => {
        return overlapStorage.getOverlapStatusWithECU(reservedECU);
      }),
    );
  }

  /**
   *
   * @param {string} wrapCmdUUID
   */
  removeOverlapWCU(wrapCmdUUID) {
    this.cmdOverlapStorageList.forEach(overlapStorage => {
      overlapStorage.removeOverlapWCU(wrapCmdUUID);
    });
  }

  /**
   * NOTE:
   * FIXME: 명령 취소를 할 경우 ECU 제거 및 DCC 명령 정리 필요
   * 생성된 명령의 누적 호출 목록을 추가한다.
   * @param {complexCmdWrapInfo} complexCmdWrapInfo 복합 명령 객체
   */
  updateOverlapCmdWrapInfo(complexCmdWrapInfo) {
    // BU.CLI(complexCmdWrapInfo);
    const {
      wrapCmdId,
      wrapCmdUUID,
      wrapCmdType,
      containerCmdList,
      realContainerCmdList,
    } = complexCmdWrapInfo;

    // 명령 취소일 경우 누적 카운팅 제거

    // 명령 모드가 자동일 경우에 누적 명령 반영
    // BU.CLIN(this.cmdManager);
    if (this.cmdManager.getCurrCmdMode() !== this.cmdManager.cmdModeType.MANUAL) {
      containerCmdList.forEach(containerCmdInfo => {
        const {
          singleControlType: conType,
          controlSetValue: conSetValue,
          eleCmdList,
        } = containerCmdInfo;

        // 세부 제어 명령 목록을 순회하면서 명령 호출 누적 처리
        _.forEach(eleCmdList, eleCmdInfo => {
          const { nodeId } = eleCmdInfo;

          // 명령 취소라면 wrapCmdUUID를 가진 누적 명령 전부 삭제
          if (wrapCmdType === reqWrapCmdType.CANCEL) {
            // 해당 Node를 가진 명령 누적 저장소의 제어 객체에 WCU 제거
            // 기존에 실행한 CONTROL 명령 누적 WCU는 삭제
            this.getOverlapStorage(nodeId)
              .getOverlapStatus(conType, conSetValue)
              .removeOverlapWCU(wrapCmdUUID);
          }
          // 제어 명령이라면 제어 객체에 WCU 추가
          else if (wrapCmdType === reqWrapCmdType.CONTROL) {
            // 해당 Node를 가진 명령 누적 저장소의 제어 객체에 WCU 제거
            this.getOverlapStorage(nodeId)
              .getOverlapStatus(conType, conSetValue)
              .addOverlapWCU(wrapCmdUUID);
          }
          // FIXME: RESTORE 명령 생성 시 작업 필요
        });
      });
    }

    // 실제 장치를 조작하는 목록만큼 돌면서 Ele Cmd UUID를 정의
    realContainerCmdList.forEach(realContainerCmdInfo => {
      const {
        singleControlType: conType,
        controlSetValue: conSetValue,
        eleCmdList,
      } = realContainerCmdInfo;

      // 세부 제어 명령 목록을 순회하면서 명령 호출 누적 처리
      _.forEach(eleCmdList, eleCmdInfo => {
        const { nodeId, uuid: eleCmdUUID } = eleCmdInfo;

        // 해당 Node를 가진 명령 누적 저장소의 제어 객체에 ECU 정의
        this.getOverlapStorage(nodeId)
          .getOverlapStatus(conType, conSetValue)
          .setReservedECU(eleCmdUUID);
      });
    });
  }

  /**
   * 명령 충돌 체크. 수동 모드를 제외하고 체크 처리.
   * 누적 명령 충돌이 일어나지 않고 Overlap Status 객체가 존재하지 않는다면 생성
   * @param {complexCmdWrapInfo} complexCmdWrapInfo 복합 명령 객체
   * @return {boolean} 충돌이 발생할 경우 true, 아니라면 false, 에러가 생길경우 throw
   */
  isConflictCommand(complexCmdWrapInfo) {
    try {
      const { wrapCmdId, wrapCmdUUID, containerCmdList } = complexCmdWrapInfo;
      // 각각의 제어 명령들의 존재 여부 체크. 없을 경우 추가
      _.forEach(containerCmdList, containerCmdInfo => {
        const {
          singleControlType: conType,
          controlSetValue: conSetValue,
          eleCmdList,
        } = containerCmdInfo;

        // 각 노드들을 확인
        _.forEach(eleCmdList, eleCmdInfo => {
          const { nodeId } = eleCmdInfo;

          // 해당 Node를 가진 명령 누적 저장소 호출
          const overlapStorage = this.getOverlapStorage(nodeId);

          const existWCUs = overlapStorage.getOverlapStatus(conType, conSetValue).getOverlapWCUs();

          // 이미 존재하고 있는 Wrap Command UUID 라면 에러
          if (_.includes(existWCUs, wrapCmdUUID)) {
            throw new Error(`A node(${nodeId}) same WCU(${wrapCmdUUID}) already exists.`);
          }

          // 충돌 체크 (해당 저장소에 다른 명령 누적이 기존재하는지 체크)
          const existOverlapInfo = overlapStorage.getExistWcuListExceptOption(conType, conSetValue);

          if (!_.isEmpty(existOverlapInfo)) {
            throw new Error(
              `Conflict of WCI(${wrapCmdId}) SingleControlType(${conType}) of node(${nodeId})`,
            );
          }
        });
      });
    } catch (error) {
      throw error;
    }
  }
}
module.exports = CmdOverlapManager;
