/**
 * @typedef {Object} deviceMap
 * @property {drawInfo} drawInfo
 * @property {setInfo} setInfo
 * @property {Array.<mapControl>} controlList
 * @property {Object} realtionInfo
 */

/**
 * @typedef {Object} mapControl
 * @property {string} cmdName 명령 이름
 * @property {string[]} trueList
 * @property {string[]} falseList
 */

/**
 * @typedef {Object} drawInfo
 * @property {frame} frame
 * @property {position} positionList
 */

/**
 * @typedef {Object} frame
 * @property {{width: number, height: number}} mapSize
 * @property {Array.<svgModelResource>} svgModelResourceList
 */

/**
 * @typedef {Object} svgModelResource
 * @property {string} id
 * @property {string} type 'rect', 'line', 'circle', 'squares'
 * @property {Object} elementDrawInfo
 */

/**
 * @typedef {Object} elementDrawInfo
 * @property {number=} width
 * @property {number=} height
 * @property {number=} radius
 * @property {number=} strokeWidth
 * @property {string} color
 */

/**
 * @typedef {Object} setInfo
 * @property {modelInfo} modelInfo
 * @property {Array.<connectInfo>} connectInfoList
 */

/**
 * @typedef {Object} modelInfo
 * @property {Array.<deviceModel>} waterDoor
 * @property {Array.<deviceModel>} valve
 * @property {Array.<deviceModel>} pump
 * @property {Array.<deviceModel>} salinity
 * @property {Array.<deviceModel>} waterLevel
 * @property {Array.<deviceModel>} waterTemperature
 * @property {Array.<deviceModel>} moduleFrontTemperature
 * @property {Array.<deviceModel>} moduleRearTemperature
 */

/**
 * @typedef {Object} connectInfo 장치와의 접속 정보
 * @property {bollean} hasOneAndOne
 * @property {string} type 'socket', 'serial', 'zigbee', ...
 * @property {string=} subType 'parser', 'xbee', ....
 * @property {number=} baudRate
 * @property {string=|number=} port
 * @property {string=} host 접속 경로(socket 일 경우 사용)
 * @property {Object=} addConfigInfo type, subType의 Contoller에서 요구하는 추가 접속 정보
 * @property {Array.<deviceRouter>} deviceRouterList type, subType의 Contoller에서 요구하는 추가 접속 정보
 */

/**
 * @typedef {Object} deviceModel
 * @property {string} targetId
 * @property {string} targetName
 * @property {number|string} targetData
 */
//  * @property {SalternDevice} salternRouter

/**
 * @typedef {Object} deviceRouter
 * @property {string} targetId
 * @property {string} targetCategory
 * @property {string} targetProtocol
 * @property {string} deviceId
 * @property {string[]} nodeModelList
 */

/**
 * @typedef {Object} connectInfo 장치와의 접속 정보
 * @property {bollean} hasOneAndOne
 * @property {string} type 'socket', 'serial', 'zigbee', ...
 * @property {string=} subType 'parser', 'xbee', ....
 * @property {number=} baudRate
 * @property {string=|number=} port
 * @property {string=} host 접속 경로(socket 일 경우 사용)
 * @property {Object=} addConfigInfo type, subType의 Contoller에서 요구하는 추가 접속 정보
 */

module;
