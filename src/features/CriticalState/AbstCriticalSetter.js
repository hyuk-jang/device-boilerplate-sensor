const _ = require('lodash');

const AbstCriticalManager = require('./AbstCriticalManager');

require('./criFormat');

class AbstCriticalSetter {
  /** @param {MainControl} controller */
  constructor(controller) {
    this.controller = controller;

    this.deviceMap = controller.deviceMap;

    // 장치 목록
    this.nodeList = controller.nodeList;
    // 장소 목록
    /** @type {placeInfo[]} */
    this.placeList = controller.placeList;

    this.placeRelationList = this.deviceMap.relationInfo.placeRelationList;
  }

  init() {
    this.setPlaceCritical();
  }

  /**
   * @abstract
   * @param {criPlaceInfo} placeInfo
   * @param {mCriticalControlInfo} criticalConInfo
   */
  addCritical(placeInfo, criticalConInfo) {
    !_.has(placeInfo, 'criticalManagerList') && _.set(placeInfo, 'criticalManagerList', []);
    placeInfo.criticalManagerList.push(new AbstCriticalManager(criticalConInfo));
  }

  /** 장소별 임계치 추가 */
  setPlaceCritical() {
    this.placeRelationList.forEach(placeClassInfo => {
      placeClassInfo.defList.forEach(placeDefInfo => {
        const { target_prefix: pdPrefix, placeList } = placeDefInfo;
        placeList.forEach(placeInfo => {
          const { target_code: pCode = null, place_info: detailPlaceInfo } = placeInfo;
          // Place ID 정의
          const placeId = `${pdPrefix}${pCode ? `_${pCode}` : ''}`;

          // 임계치 목록이 있을 경우에 설정
          if (
            _.has(detailPlaceInfo, 'criticalControlList') &&
            _.isArray(detailPlaceInfo.criticalControlList)
          ) {
            detailPlaceInfo.criticalControlList.forEach(criticalInfo => {
              // placeList 객체안에 존재한다면
              const foundPlace = _.find(this.placeList, { place_id: placeId });
              if (foundPlace) {
                this.addCritical(foundPlace, criticalInfo);
              }
            });
          }
        });
      });
    });
  }
}
module.exports = AbstCriticalSetter;
