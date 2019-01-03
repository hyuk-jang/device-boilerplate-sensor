// const Converter = require('device-protocol-converter-jh');
const Converter = require('../../../../../device-protocol-converter-jh');

const keyInfo = Converter.BaseModel.Inverter.BASE_KEY;

/**
 * @typedef {Object} blockConfig
 * @property {string} blockCategory 데이터를 저장하는 트리거 카테고리.
 * @property {baseTableInfo} baseTableInfo
 * @property {applyTableInfo=} applyTableInfo
 * @property {troubleTableInfo=} troubleTableInfo
 */

/**
 * @typedef {Object} baseTableInfo DB Table 간 이전 Table 컬럼명을 반영할 Table 컬럼 명으로 변환
 * @property {string} tableName 참조할 Table 명
 * @property {fromToKeyTableInfo[]} fromToKeyTableList tableName에 지정한 table에서 추출할 Param 값 목록
 */

/**
 * @typedef {Object} fromToKeyTableInfo DB Table 간 이전 Table 컬럼명을 반영할 Table 컬럼 명으로 변환
 * @property {string} fromKey 이전 DB Column Key
 * @property {string} toKey 이후 DB Column Key
 */

/**
 * @typedef {Object} applyTableInfo
 * @property {string} tableName 삽입할 Table 명
 * @property {string=} insertDateColumn 입력 날짜를 삽입하고자 할 경우 Table Column Name
 * @property {fromToKeyParam[]} matchingList 데이터 객체를 DB에 반영하기 위하여 Key 값을 가공할 정보 목록
 */

/**
 * @typedef {Object} fromToKeyParam 데이터 객체를 DB에 반영하기 위하여 Key 값을 가공할 정보
 * @property {string} fromKey 현 객체 값을 지닌 Key
 * @property {string} toKey DB에 삽입할 Key
 * @property {number|string} calculate 데이터 가공 계산식.
 * @property {number=} toFixed 가공을 통해 나온 값의 소수점 처리 자리 수.
 * @example
 * calculate 1: 현재 값에 1배수. 즉 현재 값을 그대로 사용. default
 * calculate 10: 현재 값에 10배수. 데이터: 25.3 --> 253 변경
 * calculate `${keyInfo.powerGridKw} / ${keyInfo.pvKw} * 100`: string 값을 eval 처리하여 계산하여 반환.
 */

/**
 * @typedef {Object} troubleTableInfo
 * @property {string} tableName 삽입할 Table 명
 * @property {string=} insertDateColumn 입력 날짜를 삽입하고자 할 경우 Table Column Name
 * @property {fromToKeyTableInfo[]} fromToKeyTableList 데이터 객체를 DB에 반영하기 위하여 Key 값을 가공할 정보 목록
 * @property {Object} changeColumnKeyInfo 데이터 객체를 DB에 반영하기 위하여 Key 값을 가공할 정보 목록
 * @property {string} changeColumnKeyInfo.isErrorKey 에러 여부를 반영할 Table Column
 * @property {string} changeColumnKeyInfo.codeKey 해당 에러 Code를 저장할 Column
 * @property {string} changeColumnKeyInfo.msgKey 에러 메시지(한글)를 저장할 Column
 * @property {string} changeColumnKeyInfo.occurDateKey 에러 발생일을 저장할 Column
 * @property {string} changeColumnKeyInfo.fixDateKey 에러 수정일을 저장할 Column
 * @property {Object} indexInfo
 * @property {string} indexInfo.primaryKey 프라이머리 키로 지정할 Column
 * @property {string} indexInfo.foreignKey 외래키 키로 지정할 Column
 */

/** @type {blockConfig[]} */
const blockConfigInfo = [
  {
    blockCategory: 'inverter',
    baseTableInfo: {
      tableName: 'inverter',
      fromToKeyTableList: [
        {
          fromKey: 'inverter_seq',
          toKey: 'inverter_seq',
        },
      ],
    },
    applyTableInfo: {
      tableName: 'inverter_data',
      insertDateColumn: 'writedate',
      matchingList: [
        {
          fromKey: keyInfo.pvAmp,
          toKey: 'in_a',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.pvVol,
          toKey: 'in_v',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.pvKw,
          toKey: 'in_w',
          calculate: 1000,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridRAmp,
          toKey: 'out_a',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridRsVol,
          toKey: 'out_v',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.powerGridKw,
          toKey: 'out_w',
          calculate: 1000,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridLf,
          toKey: 'l_f',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.powerPf,
          toKey: 'p_f',
          calculate: `${keyInfo.powerGridKw} / ${keyInfo.pvKw} * 100`,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.powerCpKwh,
          toKey: 'c_wh',
          calculate: 1000,
          toFixed: 1,
        },
      ],
    },
    troubleTableInfo: {
      tableName: 'pw_inverter_trouble_data',
      insertDateColumn: 'writedate',
      fromToKeyTableList: [
        {
          fromKey: 'inverter_seq',
          toKey: 'inverter_seq',
        },
      ],
      changeColumnKeyInfo: {
        isErrorKey: 'is_error',
        codeKey: 'code',
        msgKey: 'msg',
        occurDateKey: 'occur_date',
        fixDateKey: 'fix_date',
      },
      indexInfo: {
        primaryKey: 'inverter_trouble_data_seq',
        foreignKey: 'inverter_seq',
      },
    },
    deviceCategory: 'inverter',
    dataTableInfo: {
      tableName: 'pw_inverter_data',
      /** @type {tableParamFormat[]} */
      addParamList: [
        {
          fromKey: 'inverter_seq',
          toKey: 'inverter_seq',
        },
      ],
      insertDateKey: 'writedate',
      matchingList: [
        {
          fromKey: keyInfo.pvAmp,
          toKey: 'in_a',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.pvVol,
          toKey: 'in_v',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.pvKw,
          toKey: 'in_w',
          calculate: 1000,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridRAmp,
          toKey: 'out_a',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridRsVol,
          toKey: 'out_v',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.powerGridKw,
          toKey: 'out_w',
          calculate: 1000,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.gridLf,
          toKey: 'l_f',
          calculate: 1,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.powerPf,
          toKey: 'p_f',
          calculate: `${keyInfo.powerGridKw} / ${keyInfo.pvKw} * 100`,
          toFixed: 1,
        },
        {
          fromKey: keyInfo.powerCpKwh,
          toKey: 'c_wh',
          calculate: 1000,
          toFixed: 1,
        },
      ],
    },
  },
];

module.exports = blockConfigInfo;
