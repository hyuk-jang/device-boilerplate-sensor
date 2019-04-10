const _ = require('lodash');

class CriticalSetter {
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

  init() {}

  /** 장소별 임계치 추가 */
  setPlaceCritical() {
    this.placeRelationList.forEach(placeClassInfo => {
      placeClassInfo.defList.forEach(placeDefInfo => {
        const { target_prefix: pdPrefix, placeList } = placeDefInfo;
        placeList.forEach(placeInfo => {
          const {
            target_code: pCode = null,
            nodeList: pNodeList = [],
            place_info: detailPlaceInfo,
          } = placeInfo;
          // Place ID 정의
          const placeId = `${pdPrefix}${pCode ? `_${pCode}` : ''}`;

          // 임계치 목록이 있을 경우에 설정
          if (_.isArray(detailPlaceInfo.criticalControlList)) {
            detailPlaceInfo.criticalControlList.forEach(criticalInfo => {});
          }

          // prevPList 에서 placeId가 동일한 Row 추출
          const placeModelInfo = _.find(prevPList, {
            placeId,
          });

          pNodeList.forEach(nodeId => {
            const nodeInfo = _.find(prevNList, {
              nodeId,
            });

            /** @type {DV_PLACE_RELATION} */
            const placeRelationInfo = {
              node_seq: _.get(nodeInfo, 'node_seq'),
              place_seq: _.get(placeModelInfo, 'place_seq'),
            };

            // 관계 장치중에 Node Structure에 없거나 Place 정보가 없다면 관계가 없는 것으로 판단하고 해당 값은 입력하지 않음
            if (
              _(placeRelationInfo)
                .values()
                .includes(undefined)
            )
              return false;

            tempStorage.addStorage(placeRelationInfo, 'place_relation_seq', 'place_relation_seq');
          });
        });
      });
    });
  }
}
module.exports = CriticalSetter;
