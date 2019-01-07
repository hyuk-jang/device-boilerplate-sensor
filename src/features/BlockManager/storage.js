/**
 * @typedef {Object} dbInfo
 * @property {string} host 접속 경로
 * @property {string} user 접속 ID
 * @property {string} password 접속 PW
 * @property {string} database 접속 DB
 */

/**
 * @typedef {Object} deviceErrorInfo 시스템 오류, 장치 오류를 추적하기 위한 객체 정보
 * @property {string} code 장치 에러 고유 id
 * @property {string} msg 세부 오류 정보
 * @property {Date} occur_date 에러 발생 일자
 * @property {Date} fix_date 에러 수정 일자
 */

/**
 * @typedef {Object} dbTroubleRow 장치 Trouble, SystemError를 저장하고 업데이트 하기 위한 기본 테이블 스키마
 * @property {number} is_error 시스템 오류 여부 (0 or 1)
 * @property {string} code 해당 장치 Code (Unique)
 * @property {string} msg 오류에 대한 설명
 * @property {Date} occur_date 오류 발생 일
 * @property {Date} fix_date 오류 해결 일
 */

/**
 * @typedef {Object} addParamKey DB에 저장할때 추가적인 인자를 넣기위한 Key List Name
 * @property {string} fromKey 설정 정보에 저장된 Key
 * @property {string} toKey DB에 입력할 Key
 */

/**
 * @typedef {Object} dataStorageConfig 순수 데이터를 가공하기 위한 옵션
 * @property {string} deviceCategory
 * @property {troubleTableInfo} troubleTableInfo 장치 에러에 관한 처리 설정 정보
 * @property {dataTableInfo} dataTableInfo 장치 계측 데이터에 관한 처리 설정 정보
 */

/**
 * @typedef {Object} troubleTableInfo 고장 정보를 변환하고 저장하기 위한 옵션 정보
 * @property {string} tableName DB 테이블 명
 * @property {Array.<addParamKey>} addParamList 기본 장치 데이터에 추가적인 데이터를 넣을 리스트
 * @property {{isErrorKey: string, codeKey: string, msgKey: string, occurDateKey: string, fixDateKey: string}} changeColumnKeyInfo DB에 저장할 데이터
 * @property {string=} insertDateKey DB에 넣을 생성 날짜 Column Name
 * @property {{primaryKey: string=, foreignKey: string=}} indexInfo
 */

/**
 * @typedef {Object} dataTableInfo 장치 계측 정보를 변환하고 저장하기 위한 옵션 정보
 * @property {string} tableName  DB 테이블 명
 * @property {Array.<addParamKey>=} addParamList 기본 장치 데이터에 추가적인 데이터를 넣을 리스트
 * @property {string=} insertDateKey DB에 넣을 생성 날짜 Column Name
 * @property {Array.<refinedMatchingInfo>} matchingList 매칭 Key 변경 리스트
 */

/**
 * @typedef {Object} refinedMatchingInfo 순수 데이터를 가공하기 위한 옵션
 * @property {string} fromKey Device Data Key
 * @property {string} toKey DB에 입력할 Key
 * @property {string|number} calculate 데이터 가공할 계산 식. string일 경우 eval(), number 일경우 scale
 * @property {number} toFixed 소수점 자리수
 */

/**
 * @typedef {Object} deviceOperationInfo Device Controller 현재 장치의 계측 및 오류 데이터
 * @property {string} id Device Controller ID
 * @property {Object} config Device Controller를 구동하기 위한 설정
 * @property {Array|Object} data Controller에서 측정한 데이터
 * @property {Array.<deviceErrorInfo>} systemErrorList 장치와 약속한 프로토콜 상에서 발생한 에러
 * @property {Array.<deviceErrorInfo>} troubleList Controller를 구동하고 장치와 연결을 수립하고 통신하는 중간에 생기는 에러
 * @property {Date} measureDate 해당 Device Controller에서 데이터를 요청한 시각
 */

/**
 * @typedef {Object} setDeviceKeyInfo setDevice를 할 경우 설정 정보에 반영할 Key
 * @property {string} idKey 장치 id로 사용할 key
 * @property {string} deviceCategoryKey dataContainer 에 소속될 장치 카테고리 key
 */
