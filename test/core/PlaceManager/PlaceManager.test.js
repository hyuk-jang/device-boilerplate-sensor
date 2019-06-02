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

describe('PlaceManager', function() {
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

    // 6kW 급 현재 장소는 총 58개중  27개가 노드와 연결 설정되어 있음
    expect(placeManager.placeStorageList).to.length(27);
  });
});
