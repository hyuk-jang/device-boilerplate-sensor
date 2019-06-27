class CoreAlgorithm {
  /**
   * 제어 모드를 변경할 경우
   * @param {string} controlMode
   */
  updateControlMode(controlMode) {}

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
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpdateNode(coreFacade, placeNode) {}
}
module.exports = CoreAlgorithm;
