const _ = require('lodash');

const { BU, CU } = require('base-util-jh');

const Control = require('./Control');

class Model {
  /**
   * @param {Control} controller
   */
  constructor(controller) {
    this.controller = controller;
    this.nodeList = controller.nodeList;

    this.hasAverageStorage = false;

    /**
     * 평균 값을 구할 Node 장치 리스트
     * @type {string[]} node 장치들
     */
    this.averageNodeIdList = [];

    /** @type {requestCommandSet[]} */
    this.requestCommandSetList = [];
  }

  /**
   * Data 초기화
   */
  initModel() {
    // nodeList를 돌면서 데이터를 undefined 처리함
    _.forEach(this.nodeList, nodeInfo => {
      nodeInfo.data = undefined;
    });
  }

  /**
   * @desc Node 용
   * 평균 값 도출 기능을 사용하고자 할 경우
   * @param {nodeInfo[]} nodeList
   */
  bindingAverageStorageForNode(nodeList) {
    this.averageNodeIdList = _.map(nodeList, 'node_id');
    this.hasAverageStorage = true;
    const averConfig = {
      maxStorageNumber: 30, // 최대 저장 데이터 수
      keyList: this.averageNodeIdList,
    };

    this.averageStorage = new CU.AverageStorage(averConfig);
  }

  /**
   * requestCommandSet 저장
   * @param {requestCommandSet} requestCommandSet
   */
  addRequestCommandSet(requestCommandSet) {
    this.requestCommandSetList.push(requestCommandSet);
  }

  /**
   * 완료된 requestCommandSet 삭제
   * UUID 값이 있을 경우에는 uuid, commandId 비교. 없을 경우에는 commandId만 비교
   * @desc 정상적으로 완료했든, 에러 처리됐든 삭제
   * @param {requestCommandSet} requestCommandSet
   */
  completeRequestCommandSet(requestCommandSet) {
    // BU.CLIN(requestCommandSet);
    const compareInfo = {
      commandId: requestCommandSet.commandId,
    };
    // uuid 있을 경우 추가
    if (_.get(requestCommandSet, 'uuid', '').length) {
      compareInfo.uuid = requestCommandSet.uuid;
    }
    // 비교 조건과 같은 requestCommandSet 제거 후 남은 List 반환
    return _.remove(this.requestCommandSetList, requestCommand =>
      _(requestCommand)
        .pick(_.keys(compareInfo))
        .isEqual(compareInfo),
    );
  }

  /**
   * NodeList와 부합되는 곳에 데이터를 정의
   * @param {Object} receiveData
   * @return {nodeInfo[]} 갱신된 노드
   */
  onData(receiveData) {
    // BU.CLI(receiveData);
    /** @type {nodeInfo[]} */
    const renewalNodeList = [];
    // BU.CLI(receiveData);
    _.forEach(this.nodeList, nodeInfo => {
      // Node Class와 매칭되는 데이터 리스트를 가져옴
      const dataList = _.get(receiveData, nodeInfo.nd_target_id, []);
      // Node에서 사용하는 Index와 매칭되는 dataList를 가져옴
      // BU.CLI(nodeInfo.nd_target_id);
      let data = _.nth(dataList, nodeInfo.data_logger_index);
      // BU.CLI(data);

      // 평균 값 추적 중인 데이터 일 경우 평균 값 도출 메소드 사용
      if (this.hasAverageStorage && _.includes(this.averageNodeIdList, nodeInfo.node_id)) {
        data = this.averageStorage.addData(nodeInfo.node_id, data).getAverage(nodeInfo.node_id);
      }

      // 데이터가 같지 않은 경우 갱신 데이터로 처리
      if (!_.isEqual(nodeInfo.data, data)) {
        _.set(nodeInfo, 'data', data);
        // 갱신 리스트에 노드 삽입
        renewalNodeList.push(nodeInfo);
      }
      // 날짜는 항상 갱신
      _.set(nodeInfo, 'writeDate', new Date());
    });
    // if (_.some(renewalNodeList, nodeInfo => _.isUndefined(nodeInfo.data))) {
    //   BU.CLI(receiveData);
    //   BU.CLI(
    //     _(renewalNodeList)
    //       .map(node => _.pick(node, ['node_id', 'data']))
    //       .value()
    //   );
    // }
    // BU.CLI(renewalNodeList);
    return renewalNodeList;
  }
}

module.exports = Model;
