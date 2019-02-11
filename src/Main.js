const Control = require('./Control');
const MuanControl = require('./projects/UPSAS/muan/MuanControl');
const RnDControl = require('./projects/FP/RnD/RnDControl');

const Model = require('./Model');
const MuanModel = require('./projects/UPSAS/muan/MuanModel');
const RnDModel = require('./projects/FP/RnD/RnDModel');

/**
 * 프로젝트에 따라 Control과 Model을 생성.
 */
class Main {
  /**
   * @param {integratedDataLoggerConfig} config
   */
  createControl(config = {}) {
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
          case 'RnD':
          case 'muan':
            MainControl = RnDControl;
            MainModel = RnDModel;
            break;
          default:
            break;
        }
        break;
      default:
        break;
    }

    console.log(MainModel);
    MainControl.Model = MainModel;

    const mainControl = new MainControl(config);
    mainControl.Model = MainModel;

    return mainControl;
  }
}
module.exports = Main;
