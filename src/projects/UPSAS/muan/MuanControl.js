const _ = require('lodash');
const { BU, CU } = require('base-util-jh');
const { BM } = require('base-model-jh');

const Control = require('../../../Control');

const DefaultApiClient = require('../../../features/ApiCommunicator/DefaultApiClient');
const MuanScenario = require('./MuanScenario');
const DefaultPBS = require('../../../features/PowerStatusBoard/DefaultPBS');

class MuanControl extends Control {
  // /** @param {integratedDataLoggerConfig} config */
  // constructor(config) {
  //   super(config);
  // }

  bindingFeature() {
    return super.bindingFeature();
    BU.CLI('bindingFeature');
    // super.bindingFeature();
    // const test = new DefaultApiClient(this);
    /** @type {DefaultApiClient} */
    this.apiClient = new DefaultApiClient(this);
    this.apiClient.connect({
      controlInfo: {
        hasReconnect: true,
      },
      connect_info: this.config.mainSocketInfo,
    });
    // this.apiClient.connect(this.config.mainSocketInfo);

    /** @type {MuanScenario} */
    this.scenarioManager = new MuanScenario(this);

    /** @type {DefaultPBS} */
    this.powerStatusBoard = new DefaultPBS(this);
    this.powerStatusBoard.connect({
      controlInfo: {
        hasReconnect: true,
      },
      connect_info: this.config.powerStatusBoardInfo,
    });
  }

  /**
   * @desc Step 1
   * DB에서 특정 데이터를 가져오고 싶을경우
   * @param {dbInfo} dbInfo
   * @param {string} mainUUID main UUID
   * @return {Promise.<mainConfig>}
   */
  async getDataLoggerListByDB(dbInfo = this.config.dbInfo, mainUUID = this.mainUUID) {
    BU.CLI('getDataLoggerListByDB', dbInfo);
    this.mainUUID = mainUUID;
    this.config.dbInfo = dbInfo;
    const biModule = new BM(dbInfo);
    // BU.CLI(dbInfo);
    // BU.CLI(mainUUID);

    const mainWhere = _.isNil(mainUUID) ? null : { uuid: mainUUID };

    /** @type {dataLoggerConfig[]} */
    const dataLoggerControllerConfigList = [];

    // DB에서 UUID 가 동일한 main 정보를 가져옴
    const mainInfo = await biModule.getTableRow('main', mainWhere);

    // UUID가 동일한 정보가 없다면 종료
    if (_.isEmpty(mainInfo)) {
      throw new Error(`uuid: ${mainUUID}는 존재하지 않습니다.`);
    }

    // 만약 MainUUID를 지정하지 않을 경우 해당 Row의 uuid를 가져와 세팅함
    _.isNil(this.mainUUID) && _.set(this, 'mainUUID', _.get(mainInfo, 'uuid'));

    // 가져온 Main 정보에서 main_seq를 구함
    const where = {
      main_seq: _.get(mainInfo, 'main_seq', ''),
    };

    // main_seq가 동일한 데이터 로거와 노드 목록을 가져옴
    this.dataLoggerList = await biModule.getTable('v_dv_data_logger', where);
    this.nodeList = await biModule.getTable('v_dv_node', where);

    // 장소 단위로 묶을 장소 목록을 가져옴
    this.placeList = await biModule.getTable('v_dv_place', where);
    // 장소에 속해있는 센서를 알기위한 목록을 가져옴
    /** @type {V_DV_PLACE_RELATION[]} */
    const viewPlaceRelationRows = await biModule.getTable('v_dv_place_relation', where);
    // 장소 관계 목록을 순회하면서 장소목록에 속해있는 node를 삽입
    viewPlaceRelationRows.forEach(plaRelRow => {
      // 장소 시퀀스와 노드 시퀀스를 불러옴
      const { place_seq: placeSeq, node_seq: nodeSeq } = plaRelRow;
      // 장소 시퀀스를 가진 객체 검색
      const placeInfo = _.find(this.placeList, { place_seq: placeSeq });
      // 노드 시퀀스를 가진 객체 검색
      const nodeInfo = _.find(this.nodeList, { node_seq: nodeSeq });
      // 장소에 해당 노드가 있다면 자식으로 설정. nodeList 키가 없을 경우 생성
      if (_.isObject(placeInfo) && _.isObject(nodeInfo)) {
        !_.has(placeInfo, 'nodeList') && _.set(placeInfo, 'nodeList', []);
        placeInfo.nodeList.push(nodeInfo);
      }
    });

    // 리스트 돌면서 데이터 로거에 속해있는 Node를 세팅함
    this.dataLoggerList.forEach(dataLoggerInfo => {
      const {
        data_logger_seq: seqDL,
        connect_info: connectInfo = {},
        protocol_info = {},
      } = dataLoggerInfo;

      const foundNodeList = _.filter(this.nodeList, nodeInfo => nodeInfo.data_logger_seq === seqDL);

      /** @type {connect_info} */
      const connInfo = JSON.parse(connectInfo);
      if (connInfo.type === 'zigbee') {
        connInfo.type = 'socket';
        connInfo.subType = 'parser';
        connInfo.port = 9000;
        connInfo.addConfigInfo = {
          parser: 'delimiterParser',
          option: '}}',
        };
      } else if (connInfo.type === 'serial' && connInfo.subType === 'parser') {
        connInfo.type = 'socket';
        connInfo.port = 9001;
        connInfo.subType = '';
        delete connInfo.addConfigInfo;
      } else if (connInfo.type === 'serial' && connInfo.subType === '') {
        connInfo.type = 'socket';
        connInfo.port = 9002;
      }

      // 환경 정보가 strJson이라면 변환하여 저장
      _.set(dataLoggerInfo, 'connect_info', connInfo);

      BU.IsJsonString(protocol_info) &&
        _.set(dataLoggerInfo, 'protocol_info', JSON.parse(protocol_info));

      /** @type {dataLoggerConfig} */
      const loggerConfig = {
        hasDev: false,
        dataLoggerInfo,
        nodeList: foundNodeList,
        deviceInfo: {},
      };

      dataLoggerControllerConfigList.push(loggerConfig);
    });

    _.set(this, 'config.dbInfo', dbInfo);
    _.set(this, 'config.dataLoggerList', dataLoggerControllerConfigList);

    // BU.CLIN(this.config.dataLoggerList, 2);
    // await Promise.delay(10);

    return this.config;

    // _.set(this.config, 'dataLoggerList', returnValue)
    // BU.CLI(returnValue);

    // BU.CLI(file);
    // BU.writeFile('out.json', file);
  }
}
module.exports = MuanControl;
