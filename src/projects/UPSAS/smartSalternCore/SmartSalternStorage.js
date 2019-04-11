const _ = require('lodash');
const { BU } = require('base-util-jh');

require('./smartSalternFormat');

// 수문 종류(배수, 급수, 동일)
const WD_TYPE = {
  DRAINAGE: 'drainage',
  WATER_SUPPLY: 'waterSupply',
  EQUAL: 'equal',
};

// 장치를 분류하는 단위(NodeDefId 로 판별)
/** 장치를 분류하는 단위 */
const DEVICE_CATE_INFO = {
  /** 수문 WaterDoor */
  WD: ['waterDoor', 'gateValve'],
  /** 밸브 Valve */
  VALVE: ['valve'],
  /** 펌프 Pump */
  PUMP: ['pump'],
  /** 염도 Salinity */
  SAL: ['salinity'],
  /** 수위 WaterLevel */
  WL: ['waterLevel'],
  /** 온도 Temperature */
  TEMP: ['moduleFrontTemperature', 'moduleRearTemperature', 'brineTemperature'],
};

class SmartSalternStorage {
  /** @param {MainControl} controller */
  constructor(controller) {
    this.controller = controller;

    const { deviceMap, nodeList, placeList, placeRelationList } = controller;

    this.deviceMap = deviceMap;

    // 장치 목록
    this.nodeList = nodeList;
    // 장소 목록
    /** @type {ssPlaceInfo[]} */
    this.placeList = placeList;

    // 장치와 장소 관계 목록
    this.placeRelationList = placeRelationList;

    // this.ssDeviceInfo = {
    //   controlDeviceInfo: {
    //     waterDoorList: [],
    //     valveList: [],
    //     pumpList: [],
    //   },
    //   sensorDeviceInfo: {
    //     waterLevelList: [],
    //     salinityList: [],
    //     tempList: [],
    //   },
    // };

    // 스마트 염전 장소 정보
    /** @type {ssPlaceStorage} */
    this.ssPlaceStorageInfo = {
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
    console.time('initPlace');
    this.initPlace();
    console.timeEnd('initPlace');

    console.time('initCommand');
    this.initCommand();
    console.timeEnd('initCommand');

    BU.CLI(this.getPlaceByDeviceId('O_002'));
  }

  /**
   * 장치 Id를 기반으로 속해있는 장소 객체 목록 반환
   * @param {string} deviceId node_id
   */
  getPlaceByDeviceId(deviceId) {
    // 장치가 속해있는 place_seq 목록 추출
    const foundPlaceSeqList = _(this.placeRelationList)
      .filter({ node_id: deviceId })
      .map('place_seq')
      .value();

    // placeSeq를 포함하는 장소 객체 목록 반환
    return _.filter(this.placeList, placeInfo =>
      _.includes(foundPlaceSeqList, placeInfo.place_seq),
    );
  }

  /**
   * 장소 Id를 기반으로 장소 객체를 찾아 반환
   * @param {string} placeId 장소 Id
   */
  getPlace(placeId) {
    return _.find(this.placeList, { place_id: placeId });
  }

  /**
   * 장소 Id와 수문 Id를 바탕으로 해당 수문의 성격을 알아내어 반환(배수, 급수, 동일)
   * @param {string} placeId 장소 ID, placeList > place_id
   * @param {string} waterDoorId 수문 ID, nodeList > node_id
   */
  getWaterDoorType(placeId, waterDoorId) {
    // 출발지 지형 높이(Depth)
    // BU.CLIS(placeId, waterDoorId);
    const { depth: srcDepth } = this.getPlace(placeId);
    // 수문을 통해 물이 흐르기 위해서는 시작지와 도착지가 있어야함
    // 따라서 현재 수문을 사용하는 장소 외에 타 장소에서 사용되는 장소가 있어야함.
    const { place_id: plaRelId } = _.find(
      this.placeRelationList,
      plaRel => _.eq(plaRel.node_id, waterDoorId) && !_.eq(plaRel.place_id, placeId),
    );

    // 도착지 지형 높이(Depth)
    const { depth: desDepth } = this.getPlace(plaRelId);

    // 기본 수문은 동일 레벨
    let waterDoorType = WD_TYPE.EQUAL;

    // 지형이 높을 경우 배수 수문
    if (srcDepth > desDepth) {
      waterDoorType = WD_TYPE.DRAINAGE;
    } else if (srcDepth < desDepth) {
      // 지형이 낮을 경우 급수 수문
      waterDoorType = WD_TYPE.WATER_SUPPLY;
    }

    return waterDoorType;
  }

  /**
   * 수문의 타입을 식별하여 배수 or 급수 or 동일 수문으로 분류하여 세팅
   * @param {string} placeId 장소 ID, placeList > place_id
   * @param {ssDeviceInPlace} placeDeviceInfo 스마트 염전 장소 정보
   * @param { nodeInfo} nodeInfo 장치 정보
   */
  setWaterDoorType(placeId, placeDeviceInfo, nodeInfo) {
    // 수문 타입을 식별하여 삽입
    switch (this.getWaterDoorType(placeId, nodeInfo.node_id)) {
      case WD_TYPE.DRAINAGE:
        placeDeviceInfo.drainageWaterDoorList.push(nodeInfo);
        break;
      case WD_TYPE.WATER_SUPPLY:
        placeDeviceInfo.waterSupplyWaterDoorList.push(nodeInfo);
        break;
      case WD_TYPE.EQUAL:
        placeDeviceInfo.equalWaterDoorList.push(nodeInfo);
        break;
      default:
        break;
    }
  }

  /**
   * 스마트 염전 장소 관계를 초기화 진행
   * 1. 장치 카테고리 별 분류하여 저장 (펌프, 밸브, 각종 센서류 등등)
   * 2. 장소별 수문 타입 정의(배수, 급수, 동일)
   * 3. 저장소내 장소 카테고리 별 분류하여 저장(염판, 해주, 저수지, 바다)
   */
  initPlace() {
    BU.CLI('initPlace');

    const {
      brineWarehouseList,
      reservoirList,
      salternBlockList,
      seaList,
    } = this.ssPlaceStorageInfo;

    // 장소 목록의 자동 프로세스를 위한 정보(place_info)를 객체로 변환하고 카테고리에 맞게 분류
    this.placeList.forEach(placeInfo => {
      const {
        place_id: pId,
        place_info: strDetailPlaceInfo,
        pc_target_id: pcId,
        nodeList: nodesInPlace = [],
      } = placeInfo;

      /** @type {ssDeviceInPlace} */
      const deviceInPlace = {
        pumpList: [],
        valveList: [],
        waterDoorList: [],
        drainageWaterDoorList: [],
        waterSupplyWaterDoorList: [],
        equalWaterDoorList: [],
        salinityList: [],
        tempList: [],
        waterLevelList: [],
      };

      // 장치 카테고리를 포함하는 목록
      const { WD, VALVE, PUMP, SAL, TEMP, WL } = DEVICE_CATE_INFO;

      // 장소가 포함하는 장치 목록을 카테고리 별로 분류하여 저장
      nodesInPlace.forEach(nodeInfo => {
        const { nd_target_id: ndId } = nodeInfo;
        if (_.includes(WD, ndId)) {
          deviceInPlace.waterDoorList.push(nodeInfo);
          this.setWaterDoorType(pId, deviceInPlace, nodeInfo);
        } else if (_.includes(VALVE, nodeInfo)) {
          deviceInPlace.valveList.push(ndId);
        } else if (_.includes(PUMP, nodeInfo)) {
          deviceInPlace.pumpList.push(ndId);
        } else if (_.includes(SAL, nodeInfo)) {
          deviceInPlace.salinityList.push(ndId);
        } else if (_.includes(TEMP, ndId)) {
          deviceInPlace.tempList.push(nodeInfo);
        } else if (_.includes(WL, ndId)) {
          deviceInPlace.waterLevelList.push(nodeInfo);
        }
      });

      // 장소에 스마트 염전 장치 목록을 붙임
      placeInfo.ssPlaceInDeviceInfo = deviceInPlace;

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
      // BU.CLI(placeInfo.ssPlaceInDeviceInfo);
    });
  }

  // getPlaceByPcId()
  /**
   * 명령 제어 내용 초기화
   * 1. 단순 명령 시작지, 도착지 명 한글화
   * 2. 단순 명령 ID 코드 생성(srcPlaceId_TO_destPlaceId)
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
