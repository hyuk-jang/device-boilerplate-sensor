const Control = require('./Control');
const MuanControl = require('./project/UPSAS/muan/MuanControl');

const Model = require('./Model');
const MuanModel = require('./project/UPSAS/muan/MuanModel');

/**
 * 프로젝트에 따라 Control과 Model을 생성.
 */
class Main {
  /**
   * @param {integratedDataLoggerConfig} config
   */
  setControl(config = {}) {
    const { projectInfo = {} } = config;
    const { projectMainId, projectSubId } = projectInfo;

    let MainControl = Control;
    let MainModel = Model;

    switch (projectMainId) {
      case 'UPSAS':
        switch (projectSubId) {
          case 'muan':
            MainControl = MuanControl;
            MainModel = MuanModel;
            break;
          default:
            break;
        }
        break;
      case 'FP':
        switch (projectSubId) {
          case 'R&D':
            break;
          default:
            break;
        }
        break;
      default:
        break;
    }

    MainControl.Model = MainModel;

    const mainControl = new MainControl(config);
    mainControl.Model = MainModel;

    return mainControl;
  }
}
module.exports = Main;
