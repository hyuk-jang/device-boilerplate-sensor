const _ = require('lodash');

const { BU } = require('base-util-jh');

const CmdOverlapComponent = require('./CmdOverlapComponent');
const CmdOverlapStorage = require('./CmdOverlapStorage');
const CmdOverlapStatus = require('./CmdOverlapStatus');

const {
  dcmConfigModel: { controlModeInfo, reqWrapCmdType },
} = require('../../../../../default-intelligence');

class CmdOverlapManager extends CmdOverlapComponent {
  /** @param {CommandManager} cmdManager */
  constructor(cmdManager) {
    super();
    this.cmdManager = cmdManager;

    /** @type {CmdOverlapStorage[]} */
    this.cmdOverlapStorageList = cmdManager.nodeList.map(
      nodeInfo => new CmdOverlapStorage(nodeInfo),
    );
  }

  /**
   * Node Id를 가진 Node 객체 반환
   * @param {string} nodeId Node Id
   */
  getNodeInfo(nodeId) {
    return _.find(this.cmdManager.nodeList, { node_id: nodeId });
  }

  /**
   * Overlap이 존재하는 목록을 불러옴
   * @return {csOverlapControlInfo[]}
   */
  getExistOverlapStatus() {
    return this.cmdOverlapStorageList
      .map(storageInfo => {
        return storageInfo.getExistWcuListExceptOption();
      })
      .filter(result => !_.isEmpty(result));
  }

  /**
   * 해당 노드 정보를 가진 명령 누적 저장소를 호출
   * @param {string|nodeInfo} node Node ID or nodeInfo 객체
   */
  getOverlapStorage(node) {
    if (_.isString(node)) {
      node = this.getNodeInfo(node);
    }
    return _.find(this.cmdOverlapStorageList, { nodeInfo: node });
  }

  /**
   *
   * @param {string|nodeInfo} node Node ID or nodeInfo 객체
   * @param {number} singleControlType Device Protocol Converter에 요청할 명령에 대한 인자값 1: Open, On, ... ::: 0: Close, Off, undefind: Status
   * @param {*=} controlSetValue singleControlType 가 SET(3)일 경우 설정하는 값
   * @return {CmdOverlapStatus}
   */
  getOverlapStatus(node, singleControlType, controlSetValue) {
    try {
      return this.getOverlapStorage(node).getOverlapStatus(singleControlType, controlSetValue);
    } catch (error) {
      throw error;
    }
  }

  /**
   * NOTE:
   * FIXME: 명령 취소를 할 경우 ECU 제거 및 DCC 명령 정리 필요
   * 생성된 명령의 누적 호출 목록을 추가한다.
   * @param {complexCmdWrapInfo} complexCmdWrapInfo 복합 명령 객체
   */
  updateOverlapCmdWrapInfo(complexCmdWrapInfo) {
    BU.CLI('updateOverlapCmdWrapInfo');
    const { wrapCmdUUID, wrapCmdType, containerCmdList, realContainerCmdList } = complexCmdWrapInfo;

    // 명령 취소일 경우 누적 카운팅 제거

    // 제어모드가 수동 모드가 아닐 경우에만 명령 누적을 변경
    if (this.cmdManager.getControMode() !== controlModeInfo.MANUAL) {
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
            this.getOverlapStorage(nodeId)
              .getOverlapStatus(conType, conSetValue)
              .removeOverlapWCU(wrapCmdUUID);
          }
          // 제어 명령이라면 제어 객체에 WCU 추가
          else if (wrapCmdType !== reqWrapCmdType.CONTROL) {
            // 해당 Node를 가진 명령 누적 저장소의 제어 객체에 WCU 제거
            this.getOverlapStorage(nodeId)
              .getOverlapStatus(conType, conSetValue)
              .addOverlapWCU(wrapCmdUUID);
          }
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
      const { wrapCmdId, containerCmdList } = complexCmdWrapInfo;
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
          if (_.includes(existWCUs, wrapCmdId)) {
            throw new Error(`A node(${nodeId}) same WCU(${wrapCmdId}) already exists.`);
          }

          // 충돌 체크 (해당 저장소에 다른 명령 누적이 기존재하는지 체크)
          const proceedWcuList = overlapStorage.getExistWcuListExceptOption(conType, conSetValue);
          if (proceedWcuList.length) {
            // throw new Error(`A node(${nodeId}) in WCU(${proceedWcuList.toString()}) has conflict.`);
            return true;
          }
        });
      });
      return false;
    } catch (error) {
      throw error;
    }
  }
}
module.exports = CmdOverlapManager;

if (require !== undefined && require.main === module) {
  const nodeList = [
    {
      node_id: 'WD_001',
    },
    {
      node_id: 'WD_002',
    },
    {
      node_id: 'WD_003',
    },
  ];

  // 명령 누적 세부 객체 생성 및 명령 누적 WCU 추가
  const stat1 = new CmdOverlapStatus(0);
  stat1.addOverlapWCU('one');
  stat1.addOverlapWCU('two');
  const stat2 = new CmdOverlapStatus(1);
  stat2.addOverlapWCU('one');
  stat2.addOverlapWCU('two');

  /** @type {complexCmdWrapInfo} */
  const wrapCmdInfo1 = {
    wrapCmdUUID: 'wrapCmdInfo1',
    containerCmdList: [
      {
        singleControlType: 0,
        eleCmdList: [
          {
            nodeId: 'WD_001',
            uuid: 'WD_001_UUID',
          },
          {
            nodeId: 'WD_002',
            uuid: 'WD_002_UUID',
          },
        ],
      },
      {
        singleControlType: 1,
        eleCmdList: [
          {
            nodeId: 'WD_003',
            uuid: 'WD_003_UUID',
          },
        ],
      },
    ],
    realContainerCmdList: [
      {
        singleControlType: 0,
        eleCmdList: [
          {
            nodeId: 'WD_001',
            uuid: 'WD_001_UUID',
          },
          {
            nodeId: 'WD_002',
            uuid: 'WD_002_UUID',
          },
        ],
      },
      {
        singleControlType: 1,
        eleCmdList: [
          {
            nodeId: 'WD_003',
            uuid: 'WD_003_UUID',
          },
        ],
      },
    ],
  };

  // 명령 임계치 매니저 생성
  const cmdOverlapManager = new CmdOverlapManager({
    nodeList,
    getControMode: () => {
      controlModeInfo.AUTOMATIC;
    },
  });

  cmdOverlapManager.updateOverlapCmdWrapInfo(wrapCmdInfo1);

  BU.CLI(cmdOverlapManager.getExistOverlapStatus());
}
