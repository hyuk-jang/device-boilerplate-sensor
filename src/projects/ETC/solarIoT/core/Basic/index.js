const { BU } = require('base-util-jh');

const Battery = require('./Battery');

const AlgorithmMode = require('../../../../../core/AlgorithmManager/AlgorithmMode');

const commonFn = require('../algorithm/commonFn');

class ConcreteAlgorithmMode extends AlgorithmMode {
  /**
   * @override
   * 초기화
   */
  init() {
    this.operationModeInfo.algorithmId = commonFn.algorithmIdInfo.DEFAULT;
    this.operationModeInfo.algorithmName = '기본';
    this.operationModeInfo.cmdStrategy = 'MANUAL';

    const { BATTERY } = commonFn.nodeDefIdInfo;

    this.threPlaceList.push(new Battery(this.coreFacade, BATTERY));
  }

  /** 정기 계측 명령이 종료 되었을 경우 알고리즘 반영 */
  handleCompleteMeasureScheduler() {}
}
module.exports = ConcreteAlgorithmMode;
