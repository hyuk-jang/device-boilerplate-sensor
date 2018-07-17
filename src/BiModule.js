
const bmjh = require('base-model-jh');


class BiModule extends bmjh.BM {
  constructor(dbInfo) {
    super(dbInfo);

  }

  /**
   * @desc Step 1
   * DB에서 특정 데이터를 가져오고 싶을경우
   * @param {dbInfo} dbInfo 
   * @param {{data_logger_seq: number, main_seq: number=}} where Logger Sequence
   */
  async getDataLoggerInfoByDB(dbInfo, where) {
    let dataLoggerInfo = await this.db.single(`SELECT * FROM v_data_logger WHERE data_logger_seq = ${where.data_logger_seq} AND main_seq = ${where.main_seq} `);
    const nodeList = await BM.db.single(`SELECT * FROM v_node_profile WHERE data_logger_seq = ${where.data_logger_seq} AND main_seq = ${where.main_seq} `);
    this.config.dataLoggerInfo = dataLoggerInfo;
    this.config.nodeList = nodeList;

    dataLoggerInfo = _.head(dataLoggerInfo);
    dataLoggerInfo.protocol_info = JSON.parse(_.get(dataLoggerInfo, 'protocol_info'));
    dataLoggerInfo.connect_info = JSON.parse(_.get(dataLoggerInfo, 'connect_info'));

    const file = {
      dataLoggerInfo,
      nodeList
    };
    // BU.CLI(file);
    // BU.writeFile('out.json', file);
  }


}
module.exports = BiModule;