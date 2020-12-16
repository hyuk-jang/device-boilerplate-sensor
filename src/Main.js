const Control = require('./Control');

const DefaultControl = require('./projects/DefaultControl');

const MuanControl = require('./projects/UPSAS/muan/MuanControl');
const SolarControl = require('./projects/ETC/solarIoT/SolarControl');
const Muan100kWControl = require('./projects/UPSAS/muan100kW/Muan100kWControl');
const FPRndControl = require('./projects/FP/RnD/RnDControl');
const S2WRndControl = require('./projects/S2W/RnD/RnDControl');
const CompressorControl = require('./projects/PP/Compressor/CompressorControl');

const Model = require('./Model');

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

    let MainControl = DefaultControl;
    const MainModel = Model;

    switch (projectMainId) {
      case 'ETC':
        switch (projectSubId) {
          case 'solarIoT':
            MainControl = SolarControl;
            break;
          default:
            break;
        }
        break;
      case 'UPSAS':
        switch (projectSubId) {
          case 'muan':
            MainControl = MuanControl;
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
            break;
          default:
            break;
        }
        break;
      case 'S2W':
        switch (projectSubId) {
          case 'RnD':
            MainControl = S2WRndControl;
            break;
          default:
            break;
        }
        break;
      case 'PP':
        switch (projectSubId) {
          case 'RnD':
            MainControl = CompressorControl;
            break;
          default:
            MainControl = CompressorControl;
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
