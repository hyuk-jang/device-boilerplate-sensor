const _ = require('lodash');

const Control = require('./Control');

class Model {
/**
 * Creates an instance of Model.
 * @param {Control} controller
 * @memberof Model
 */
  constructor(controller) {
    

    this.dataLoggerControllerList = controller.dataLoggerControllerList;
    this.dataLoggerList = controller.dataLoggerList;
    this.nodeList = controller.nodeList;


    this.nodeStatusList = {};


  

    /** @type {combinedOrderStorage} */
    this.combinedOrderStorage = {
      controlStorage: {},
      cancelStorage: {},
      measureStorage: {}
    };
    
    // this.combinedOrderList.controlStorage = {};
    // this.combinedOrderList.cancelStorage = {};
    // this.combinedOrderList.measureStorage = {};
    


  }


  /**
   * 복합 명령을 저장소 호출
   * @param {string} commandType 저장할 타입 ADD, CANCEL, ''
   */
  getCombineOrderInfo(commandType) {
    const MEASURE = ['', undefined, null];
    const CONTROL = ['ADD', 'CONTROL'];
    const CANCEL = ['CANCEL'];

    // Measure
    if (_.includes(MEASURE, commandType)) {
      return this.combinedOrderStorage.
    } else if (_.includes(CONTROL, commandType)) {
      this.combinedOrderStorage.controlStorage.push(combinedOrderWrapInfo);
    } else if (_.includes(CANCEL, commandType)) {
      this.combinedOrderStorage.cancelStorage.push(combinedOrderWrapInfo);
    }
  }

  /**
   * 복합 명령을 저장
   * @param {string} commandType 저장할 타입 ADD, CANCEL, ''
   * @param {combinedOrderWrapInfo} combinedOrderWrapInfo 
   */
  saveCombinedOrder(commandType, combinedOrderWrapInfo) {
    const MEASURE = ['', undefined, null];
    const CONTROL = ['ADD', 'CONTROL'];
    const CANCEL = ['CANCEL'];

    // Measure
    if (_.includes(MEASURE, commandType)) {
      this.combinedOrderStorage.measureStorage.waitingList.push(combinedOrderWrapInfo);
    } else if (_.includes(CONTROL, commandType)) {
      this.combinedOrderStorage.controlStorage.waitingList.push(combinedOrderWrapInfo);
    } else if (_.includes(CANCEL, commandType)) {
      this.combinedOrderStorage.cancelStorage.waitingList.push(combinedOrderWrapInfo);
    }
  }



  checkValidateNodeData(nodeInfo, standardDate) {

  }



}
module.exports = Model;