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
    this.operationModeInfo.algorithmId = commonFn.algorithmIdInfo.AUTOMATION;
    this.operationModeInfo.algorithmName = '자동';
    this.operationModeInfo.cmdStrategy = 'OVERLAP_COUNT';

    const { BATTERY } = commonFn.nodeDefIdInfo;

    this.threPlaceList.push(new Battery(this.coreFacade, BATTERY));
  }

  /** 정기 계측 명령이 종료 되었을 경우 알고리즘 반영 */
  handleCompleteMeasureScheduler() {
    this.coreFacade.placeManager.placeStorageList.forEach(placeStorage =>
      placeStorage.updateNode(commonFn.ndId.BATTERY),
    );
  }
}
module.exports = ConcreteAlgorithmMode;
