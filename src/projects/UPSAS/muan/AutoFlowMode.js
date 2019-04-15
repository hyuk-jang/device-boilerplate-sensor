const _ = require('lodash');

const { BU } = require('base-util-jh');
const Promise = require('bluebird');
const ControlDBS = require('../../../Control');

const { reqWrapCmdType } = require('../../../../../default-intelligence').dcmConfigModel;

class AutoFlowMode {
  /** @param {ControlDBS} controller */
  constructor(controller) {
    this.controller = controller;

    this.map = this.controller.model.deviceMap;
  }

  // TODO: 1. map. brineFeedRankRelationList, brineDrainRankRelationList 를 기준으로 placeId 뽑아 해당 Place의 초기 값 설정
  // 초기 값은 수위, 염도이며 DB에서 해당 테이블이 존재할 시 최신 데이터를 불어와 매칭 시킴
  initPlace() {}

  // TODO: 2. 데이터 갱신 이벤트가 발생할 때 마다 해당 node 데이터를 가져오고 해당 place에 관계가 있다면 반영함
  // 이전 데이터와 비교를 하여 데이터 변경 시 염도 자동 산정

  // TODO: 2.1 해당 장소가 명령이 진행 중인지 체크.
  // 명령이 존재하지 않는다면 명령을 내릴 수 있는 여부 체크. true, false ID 중 하나라도 중복되지 않을 것
  // 증발지 배수 일 경우 현재 수위를 기준으로 setTimeout 설정.
  // 조건을 충족한다면 hasDrain 배수 여부를 체크하고 진행중 명령에 등록.
  //

  // TODO: 3. 장소 단위 별로 명령이 진행 중인지 체크. 명령이 없다면 현재 수위, 염도를 기반으로 급배수 여부를 체크하고 명령 발송
  // 증발지 place에서 하나라도 기준 수위 미달이라면 전체 염수 이동.
  // 일정 시간 기다린 후 염수 이동 명령 취소. 급수지 체크 후 진행
  // 급수지 별로 목표 수위를 달성시 해당 지역 밸브 닫기. 연관된 명령 없을 경우 펌프 끄기
}

module.exports = AutoFlowMode;
