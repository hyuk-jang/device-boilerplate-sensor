'use strict';
const _ = require('lodash');

const {BU, CU} = require('base-util-jh');

const Control = require('./Control');

class Model {
  /**
   * @param {Control} controller 
   */
  constructor(controller) {
    this.controller = controller;
    this.nodeList = controller.nodeList;
    this.deviceData = {};

    this.hasAverageStorage = false;
  }

  /**
   * 초기 모델 Format 정의
   */
  initModel() {
    // this.deviceData = this.controller.BaseModel.ESS.BASE_MODEL;
    let mainCategory = this.config.deviceInfo.protocol_info.mainCategory;
    // this.controller.BaseModel.ESS.
    _.set(this.model, 'deviceData', this.controller.BaseModel[mainCategory].BASE_MODEL);

  }

  /**
   * 평균 값 도출 기능을 사용하고자 할 경우
   */
  bindingAverageStorage(){
    this.hasAverageStorage = true;
    let averConfig = {
      maxStorageNumber: 30, // 최대 저장 데이터 수
      keyList: Object.keys(this.deviceData)
    };

    this.averageStorage = new CU.AverageStorage(averConfig);
    
  }

  /**
   * 현재 장치 데이터를 가져옴. key에 매칭되는...
   * @param {string} key 
   */
  getData(key){
    return _.get(this.deviceData, key);
  }

  /**
   * @param {Object} receiveData 
   */
  onData(receiveData){
    // BU.CLI(receiveData);
    if(this.hasAverageStorage){
      // 평균 값 설정
      _.set(this, 'deviceData', this.averageStorage.onData(receiveData));
    } else {
      // 데이터 로거에 붙어 있는 센서와 매칭되는 수신데이터를 삽입
      _.forEach(this.nodeList, nodeInfo => {
        const dataList = _.get(receiveData, nodeInfo.nc_target_id, []);
        _.set(nodeInfo, 'data', _.nth(dataList, nodeInfo.data_logger_index));
      });
    }
  }
}

module.exports = Model;