const _ = require('lodash');

const { BU } = require('base-util-jh');

const AlgorithmComponent = require('./AlgorithmComponent');

const CoreFacade = require('../CoreFacade');

/** 2 Depth */
class AlgorithmStorage extends AlgorithmComponent {
  constructor() {
    super();

    /** @type {AlgorithmComponent[]} 알고리즘 모드 객체 목록 */
    this.children = [];
    /** @type {AlgorithmComponent} 실행 중인 알고리즘 모드 객체 */
    this.operationMode = {};
  }

  /**
   * @param {string} algorithmId
   * @return {operationConfig} 구동 모드 알고리즘 설정 정보
   */
  getOperationConfig(algorithmId) {
    try {
      if (_.isNil(algorithmId) || algorithmId.length === 0) {
        return this.operationMode.getOperationConfig();
      }
      return this.getOperationMode(algorithmId).getOperationConfig();
    } catch (error) {
      throw error;
    }
  }

  /** @return {operationConfig[]} 구동 모드 알고리즘 설정 정보 목록 */
  getOperationConfigList() {
    return _.map(this.children, 'operationModeInfo');
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
    // BU.CLI('changeOperationMode', algorithmId);
    try {
      // 구동 모드 객체를 가져옴
      const operationMode = this.getOperationMode(algorithmId);

      // BU.CLIN(operationMode, 1);
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
