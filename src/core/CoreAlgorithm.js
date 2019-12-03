class CoreAlgorithm {
  constructor() {
    this.algorithmId = '';
    this.algorithmName = '';
  }

  /**
   * 제어 모드가 변경된 경우
   * @param {string} controlMode 제어 모드
   */
  updateControlMode(controlMode) {}

  /**
   * 현재 제어 모드 가져옴
   * @return {string} controlMode 제어 모드
   */
  getCurrControlMode() {
    return this.algorithmId;
  }

  /**
   * 현재 제어 모드 가져옴
   * @return {string} controlMode 제어 모드 명
   */
  getCurrControlModeName() {
    return this.algorithmName;
  }

  /**
   * 흐름 명령을 수행할 수 있는지 여부 체크
   * @param {string} srcPlaceId
   * @param {string} destPlaceId
   * @param {csCmdGoalInfo=} goalInfo
   */
  isPossibleFlowCommand(srcPlaceId, destPlaceId, goalInfo) {}

  /**
   * 노드 데이터 갱신
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpdateNode(coreFacade, placeNode) {}
}
module.exports = CoreAlgorithm;
