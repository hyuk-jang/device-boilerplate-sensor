const _ = require('lodash');
const { BU } = require('base-util-jh');

class SmartSalternStorage {
  /** @param {MainControl} controller */
  constructor(controller) {
    this.controller = controller;

    this.deviceMap = controller.deviceMap;

    this.placeList = controller.placeList;

    this.ssDeviceInfo = {
      controlDeviceInfo: {
        waterDoorList: [],
        valveList: [],
        pumpList: [],
      },
      sensorDeviceInfo: {
        waterLevelList: [],
        salinityList: [],
        tempList: [],
      },
    };

    // 스마트 염전 장소 정보
    this.ssPlaceInfo = {
      salternBlockList: [],
      brineWarehouseList: [],
      reservoirList: [],
      seaList: [],
    };

    // 스마트 염전 명령 정보
    this.ssCommandInfo = {
      simpleControlList: [],
      settingControlList: [],
    };
  }

  init() {
    this.initPlace();

    this.initCommand();
  }

  initPlace() {
    BU.CLI('initPlace');

    const { brineWarehouseList, reservoirList, salternBlockList, seaList } = this.ssPlaceInfo;

    // 장소 목록의 자동 프로세스를 위한 정보(place_info)를 객체로 변환하고 카테고리에 맞게 분류
    this.placeList.forEach(placeInfo => {
      const { place_info: strDetailPlaceInfo, pc_target_id: pcId } = placeInfo;
      // 스마트 염전 장소 정보를 Json 객체로 변환 후 재정의
      if (BU.IsJsonString(strDetailPlaceInfo)) {
        _.set(placeInfo, 'autoFlowInfo', JSON.parse(strDetailPlaceInfo));
        delete placeInfo.place_info;
      }

      // Place Class 분류에 따라 장소를 분류함
      switch (pcId) {
        case 'salternBlock':
          salternBlockList.push(placeInfo);
          break;
        case 'brineWarehouse':
          brineWarehouseList.push(placeInfo);
          break;
        case 'reservoir':
          reservoirList.push(placeInfo);
          break;
        case 'sea':
          seaList.push(placeInfo);
          break;
        default:
          break;
      }
    });
    // BU.CLI(this.ssPlaceInfo);
  }

  // getPlaceByPcId()
  /**
   * 명령 제어에 필요한 추가 구성
   */
  initCommand() {
    const { simpleModeList, settingModeList } = this.deviceMap.controlInfo;

    // 단순 명령을 쉽게 인식하기 위한 한글 명령을 입력
    simpleModeList.forEach(simpleCommandInfo => {
      const { srcPlaceId } = simpleCommandInfo;

      // 시작지 한글 이름
      const srcPlaceName = _.chain(this.placeList)
        .find({ place_id: srcPlaceId })
        .get('place_name')
        .value();

      _.set(simpleCommandInfo, 'srcPlaceName', srcPlaceName);

      simpleCommandInfo.destList.forEach(scDesInfo => {
        const { destPlaceId } = scDesInfo;

        // 도착지 한글 이름
        const destPlaceName = _.chain(this.placeList)
          .find({ place_id: destPlaceId })
          .get('place_name')
          .value();

        _.set(simpleCommandInfo, 'destPlaceName', srcPlaceName);
        // 한글 명령
        _.set(scDesInfo, 'commandId', `${srcPlaceId}_TO_${destPlaceId}`);
        _.set(scDesInfo, 'commandName', `${srcPlaceName} → ${destPlaceName}`);
      });
    });

    // BU.CLI(simpleModeList);
    this.ssCommandInfo.simpleControlList = simpleModeList;
    this.ssCommandInfo.settingControlList = settingModeList;
  }
}

module.exports = SmartSalternStorage;

/**
 * @typedef {Object} simpleCommandInfo
 * @property {string} srcPlaceId 시작 장소 ID
 * @property {string} srcPlaceName 시작 장소 명
 * @property {Object[]} destList 목적지 장소 목록
 * @property {string} destList.destPlaceId 목적지 장소 Id
 * @property {string} destList.destPlaceName 목적지 장소 명
 * @property {string} destList.commandId 명령 이름 영어(srcPlaceId_TO_destPlaceId)
 * @property {string} destList.commandName 명령 이름 한글(srcPlaceId → destPlaceId)
 * @property {string} destList.actionType common(에뮬레이터, 실제 동작) or controller(실제 동작) or emulator(에뮬레이터)
 * @property {string[]} destList.trueNodeList Open, On 등 장치 동작 수행
 * @property {string[]} destList.falseNodeList Close, Off 등 장치 동작 정지
 */
