const Control = require('./Control');
const MuanControl = require('./projects/UPSAS/muan/MuanControl');
const Muan100kWControl = require('./projects/UPSAS/muan100kW/Muan100kWControl');
const FPRndControl = require('./projects/FP/RnD/RnDControl');
const S2WRndControl = require('./projects/S2W/RnD/RnDControl');

const Model = require('./Model');
const MuanModel = require('./projects/UPSAS/muan/MuanModel');
const FPRndModel = require('./projects/FP/RnD/RnDModel');
const S2WRndModel = require('./projects/S2W/RnD/RnDModel');

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
          case 'muan100kW':
            MainControl = Muan100kWControl;
            break;
          default:
            break;
        }
        break;
      case 'FP':
        switch (projectSubId) {
          case 'RnD':
            MainControl = FPRndControl;
            MainModel = FPRndModel;
            break;
          default:
            break;
        }
        break;
      case 'S2W':
        switch (projectSubId) {
          case 'RnD':
            MainControl = S2WRndControl;
            MainModel = S2WRndModel;
            break;
          default:
            break;
        }
        break;
      default:
        break;
    }

    const mainControl = new MainControl(config);
    mainControl.Model = MainModel;

    return mainControl;
  }
}
module.exports = Main;
