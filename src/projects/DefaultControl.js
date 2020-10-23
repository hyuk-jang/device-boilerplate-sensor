const _ = require('lodash');

const { BU } = require('base-util-jh');

const Control = require('../Control');

const { ApiClient, BlockManager, PBS } = require('../features/index');

module.exports = class extends Control {
  /**
   * @override
   * DBS 순수 기능 외에 추가 될 기능
   */
  bindingFeature() {
    // 기본 Binding Feature 사용
    super.bindingFeature();
    /** @type {DefaultApiClient} */
    this.apiClient = new ApiClient(this);

    /** @type {BlockManager} */
    this.blockManager = new BlockManager(this);
  }

  /**
   * @desc init Step: 5
   * 생성된 Feature를 구동시킴
   * @param {dbsFeatureConfig} featureConfig
   * @return {Promise}
   */
  async runFeature(featureConfig = _.get(this, 'config.projectInfo.featureConfig', {})) {
    const { apiConfig } = featureConfig;

    process.env.PJ_IS_API_CLIENT === '1' &&
      this.apiClient.connect({
        controlInfo: {
          hasReconnect: true,
        },
        connect_info: apiConfig,
      });
  }
};
