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
   * 프로그램의 메인 컨트롤을 담당하는 컨트롤러 생성
   * @param {integratedDataLoggerConfig} config
   */
  createControl(config = {}) {
    const { projectInfo = {} } = config;
    const { projectMainId, projectSubId } = projectInfo;

    // 기본 Control, Model 정의
    let MainControl = DefaultControl;
    const MainModel = Model;

    // 프로젝트를 다르게 하여 생성할 경우 덮어씀
    switch (projectMainId) {
      // 잡다한 프로젝트
      case 'ETC':
        switch (projectSubId) {
          // 에너지 소비 최적화
          case 'solarIoT':
            MainControl = SolarControl;
            break;
          default:
            break;
        }
        break;
      // 수중태양광 Underwater Photovoltaic Systems Applying for Salt farms
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
      // 농병 Farm Parallel >> Agrophotovoltaic
      case 'FP':
        switch (projectSubId) {
          case 'RnD':
            MainControl = FPRndControl;
            break;
          default:
            break;
        }
        break;
      // 태양광 이모작 Solar 2 Way
      case 'S2W':
        switch (projectSubId) {
          case 'RnD':
            MainControl = S2WRndControl;
            break;
          default:
            break;
        }
        break;
      // Personal Project
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
