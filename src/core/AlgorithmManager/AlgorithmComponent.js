/** 1 Depth */
class AlgorithmComponent {
  /** 초기화 */
  init() {}

  /**
   * 구동 모드 객체를 추가함
   * @param {AlgorithmComponent} algorithmMode
   */
  addOperationMode(algorithmMode) {}

  /**
   * 구동 모드를 알고리즘 Id로 찾아와서 반환
   * @param {string} algorithmId
   * @return {AlgorithmComponent}
   */
  getOperationMode(algorithmId) {}

  /** @return {operationConfig} 구동 모드 알고리즘 설정 정보 */
  getOperationConfig() {}

  /** @return {operationConfig[]} 구동 모드 알고리즘 설정 정보 목록 */
  getOperationConfigList() {}

  /**
   * 구동 모드를 변경할 경우(Api Server에서 요청)
   * @param {string} algorithmId 제어 모드
   */
  changeOperationMode(algorithmId) {}

  /**
   * 현재 구동 모드 알고리즘 ID 가져옴
   * @return {string} Algorithm Id
   */
  get algorithmId() {
    return '';
  }

  /**
   * 현재 구동 모드 알고리즘 Name 가져옴
   * @return {string} Algorithm Name
   */
  get algorithmName() {
    return '';
  }

  /**
   * 현재 명령 전략 가져옴
   * @return {string} cmdStrategy
   */
  get cmdStrategy() {
    return '';
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
   * @param {CoreFacade} coreFacade Core Facade
   * @param {PlaceComponent} placeNode 데이터 갱신이 발생한 노드
   */
  handleUpdateNode(coreFacade, placeNode) {}
}
module.exports = AlgorithmComponent;
