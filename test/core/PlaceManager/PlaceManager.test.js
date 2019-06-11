require('dotenv').config();

const _ = require('lodash');
const { expect } = require('chai');

const { BU } = require('base-util-jh');

const { nodeList, placeList, placeRelationList } = require('./config');

const PlaceManager = require('../../../src/core/PlaceManager/PlaceManager');
const PlaceStorage = require('../../../src/core/PlaceManager/PlaceStorage');
const PlaceNode = require('../../../src/core/PlaceManager/PlaceNode');

// Model에서 Place를 초기 설정할 메소드
function Model() {
  this.nodeList = nodeList;
  this.placeList = placeList;
  this.placeRelationList = placeRelationList;
}

// 100kW 급 테스트
describe('100kW 무안 테스트베드', function() {
  /**
   * 1. Place Manager Tree를 구성한다.
   * 2. Manager, Storage, Node 메소드가 잘 작동하는지 확인
   * 3. Control Mode가 변경되었을 경우 모든 Tree 구조의 말단까지 전파가 잘 되는지 확인
   * 4. Node Updator 에 각 노드들을 옵저버로 등록하고 데이터를 수신 받는지 테스트
   */
  it('PlaceStorage', function() {
    // 1. Place Manager Tree를 구성한다.
    const placeManager = new PlaceManager(new Model());
    placeManager.init();

    // * 1. Place Manager Tree를 구성한다.
    // 장소는 총 4개. 중복 1개(SEB_1), Node 객체 연결 없는 장소 1개(WW_017).
    // 따라서 2개여야 함
    expect(placeManager.placeStorageList).to.length(2);

    // 수중 증발지 1 저장소 객체를
    const seb1Storage = placeManager.getPlaceStorage('SEB_1');
    const s001PlaceNode = seb1Storage.getPlaceNode('S_002');

    // 수중 태양광 1은 센서 4개(S_002, WL_008, MRT_001, BT_001)로 이루어짐
    expect(seb1Storage.children).to.length(4);
    expect(seb1Storage.getPlaceId()).to.eq('SEB_1');
    // 임계치 호출 메소드가 정상적으로 요청되어야 한다
    expect(s001PlaceNode.handleError());
    expect(s001PlaceNode.handleLowerLimitUnder());
    expect(s001PlaceNode.handleMaxOver());
    expect(s001PlaceNode.handleMinUnder());
    expect(s001PlaceNode.handleNormal());
    expect(s001PlaceNode.handleUnknown());
    expect(s001PlaceNode.handleUpperLimitOver());

    // 염도 상한선 10.5도
    expect(seb1Storage.getPlaceNode('S_002').upperLimitValue).to.eq(10.5);
    // 수위 하한선 2.9 cm
    expect(seb1Storage.getPlaceNode('WL_008').lowerLimitValue).to.eq(2.9);

    // 수중 태양광 2는 센서 3개(S_003, WL_009, MRT_002)로 이루어짐
    expect(placeManager.getPlaceStorage('SEB_2').children).to.length(3);
  });
});
