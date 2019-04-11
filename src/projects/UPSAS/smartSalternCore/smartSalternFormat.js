/**
 * @typedef {Object} ssPlaceStorage 스마트 염전 장소 종류
 * @property {ssPlaceInfo[]} salternBlockList 염판 목록
 * @property {ssPlaceInfo[]} brineWarehouseList 해주 목록
 * @property {ssPlaceInfo[]} reservoirList 저수지
 * @property {ssPlaceInfo[]} seaList 바다
 */

/**
 * @typedef {Object} ssPlaceInfo 스마트 염전 장소 정보. 기존 placeInfo에 스마트 염전 장소 분류 확장
 * @property {number} place_seq 장소 정보 시퀀스
 * @property {number} place_def_seq 장소 개요 정보 시퀀스
 * @property {number} place_class_seq 장소 대분류 시퀀스
 * @property {number} main_seq MAIN 시퀀스
 * @property {string} uuid uuid
 * @property {string} m_name 지역 이름
 * @property {string} place_id
 * @property {string} place_real_id
 * @property {string} place_name
 * @property {string} p_target_code 장소 번호
 * @property {string} p_target_name 장소 명
 * @property {number} depth 장소 상대적 위치
 * @property {string} place_info 장소 상세 정보
 * @property {string} chart_color 차트 색상
 * @property {number} chart_sort_rank 차트 정렬 순위
 * @property {string} pd_target_prefix 장소 접두사
 * @property {string} pd_target_id 장소 개요 id
 * @property {string} pd_target_name 이름
 * @property {string} pc_target_id 장소 id
 * @property {string} pc_target_name 장소 대분류 명
 * @property {string} pc_description 장소 분류 설명
 * @property {nodeInfo[]} nodeList 장소 분류 설명
 * @property {CriticalManager[]} criticalManagerList 임계치 관리자 목록
 * @property {ssDeviceInPlace} ssPlaceInDeviceInfo 장소 분류 설명
 */

/**
 * @typedef {Object} ssDeviceInPlace 스마트 염전 장소가 가지는 장치 목록
 * @property {nodeInfo[]} waterDoorList 수문 장치 목록
 * @property {nodeInfo[]} drainageWaterDoorList 배수 수문 목록
 * @property {nodeInfo[]} waterSupplyWaterDoorList 급수 수문 목록
 * @property {nodeInfo[]} equalWaterDoorList 동일 수문 목록
 * @property {nodeInfo[]} pumpList 동일 수문 목록
 * @property {nodeInfo[]} valveList 동일 수문 목록
 * @property {nodeInfo[]} waterLevelList 수위 목록
 * @property {nodeInfo[]} salinityList 염도 목록
 * @property {nodeInfo[]} tempList 염도 목록
 */

/**
 * @typedef {Object} simpleCommandInfo
 * @property {string} srcPlaceId 시작 장소 ID
 * @property {string} srcPlaceName 시작 장소 명
 * @property {Object[]} destList 목적지 장소 목록
 * @property {string} destList.destPlaceId 목적지 장소 Id
 * @property {string} destList.destPlaceName 목적지 장소 명
 * @property {string} destList.commandId 명령 이름 영어(srcPlaceId_TO_destPlaceId)
 * @property {string} destList.commandName 명령 이름 한글(srcPlaceId → destPlaceId)
 * @property {string} destList.actionType common(에뮬레이터, 실제 동작) or controller(실제 동작) or emulator(에뮬레이터)
 * @property {string[]} destList.trueNodeList Open, On 등 장치 동작 수행
 * @property {string[]} destList.falseNodeList Close, Off 등 장치 동작 정지
 */
