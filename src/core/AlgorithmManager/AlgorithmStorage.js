const _ = require('lodash');

const { BU } = require('base-util-jh');

const AlgorithmComponent = require('./AlgorithmComponent');

const { nodeDefIdInfo: ndId } = AlgorithmComponent;
const CoreFacade = require('../CoreFacade');
const PlaceComponent = require('../PlaceManager/PlaceComponent');

class AlgorithmStorage extends AlgorithmComponent {
  constructor() {
    super();

    /** @type {AlgorithmComponent[]} */
    this.children = [];
    /** @type {AlgorithmComponent} */
    this.operationMode = {};
  }

  /** @return {wsModeInfo} 구동 모드 알고리즘 설정 정보 */
  getOperationConfig() {
    return this.operationMode.operationModeInfo;
  }

  /**
   * 구동 모드 객체를 추가함
   * @param {AlgorithmComponent} algorithmMode
   */
  addOperationMode(algorithmMode) {
    // 이미 존재한다면 false 반환
    if (_.findIndex(this.children, algorithmMode) !== -1) return false;

    // 삽입 후 true 반환
    return this.children.push(algorithmMode) && true;
  }

  /**
   * 구동 모드를 알고리즘 Id로 찾아와서 반환
   * @param {string} algorithmId
   * @return {AlgorithmComponent}
   */
  getOperationMode(algorithmId) {
    // BU.CLI(this.children.length);
    return _.find(this.children, operationMode => {
      return operationMode.algorithmId === algorithmId;
    });
  }

  /**
   * 구동 모드를 변경할 경우(Api Server에서 요청)
   * @param {string} algorithmId 제어 모드
   */
  changeOperationMode(algorithmId) {
    BU.CLI('changeOperationMode', algorithmId);
    try {
      // 구동 모드 객체를 가져옴
      const operationMode = this.getOperationMode(algorithmId);

      BU.CLIN(operationMode, 1);

      // 구동 모드가 존재하지 않을 경우
      if (_.isEmpty(operationMode)) {
        throw new Error(`algorithmId: (${algorithmId}) is not exist.`);
      }
      // 구동 모드가 동일 할 경우
      if (operationMode === this.operationMode) {
        return false;
        // throw new Error(`algorithmId: (${algorithmId}) is the same operation mode.`);
      }

      // 구동 모드 변경
      this.operationMode = operationMode;

      // 명령 전략 교체 요청
      const coreFacade = new CoreFacade();
      coreFacade.changeCmdStrategy(this.operationMode.cmdStrategy);

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 현재 제어 모드와 틀리다면 변경 후 제어모드 변경 알림
   * @param {AlgorithmStorage} operationMode
   */
  updateOperationMode(operationMode) {
    // BU.CLIS(this.currControlMode, controlMode);
    if (this.operationMode !== operationMode) {
      this.operationMode = operationMode;
      // 세부 모드 별 알고리즘에 제어 모드 변경 알림 처리
      this.operationMode.updateOperationMode();
      return true;
    }
    return false;
  }

  /**
   * 흐름 명령을 수행할 수 있는지 여부 체크
   * @param {PlaceManager} placeManager
   * @param {string} srcPlaceId
   * @param {string} destPlaceId
   * @param {csCmdGoalInfo=} goalInfo
   */
  isPossibleFlowCommand(placeManager, srcPlaceId, destPlaceId, goalInfo) {}

  /**
   * 노드 데이터 갱신
   * @param {CoreFacade} coreFacade Place Manager
   * @param {placeManager} placeManager Place Manager
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpdateNode(coreFacade, placeNode) {
    try {
      this.operationMode.handleUpdateNode(coreFacade, placeNode);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = AlgorithmStorage;
