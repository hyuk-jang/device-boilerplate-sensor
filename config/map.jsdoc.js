

/**
 * @typedef {Object} deviceMap
 * @prop {drawInfo} drawInfo
 * @prop {setInfo} setInfo
 * @prop {Object} realtionInfo
 * @prop {Array.<control>} controlList   // TEST
 * @prop {Array.<control>} simpleList   // TEST
 */

/**
 * @typedef {Object} drawInfo
 * @prop {frame} frame
 * @prop {position} positionList
 */


/**
 * @typedef {Object} frame
 * @prop {{width: number, height: number}} mapSize
 * @prop {Array.<svgModelResource>} svgModelResourceList
 */

 
/**
 * @typedef {Object} svgModelResource
 * @prop {string} id
 * @prop {string} type 'rect', 'line', 'circle', 'squares'
 * @prop {Object} elementDrawInfo
 */
 
/**
 * @typedef {Object} elementDrawInfo
 * @prop {number=} width
 * @prop {number=} height
 * @prop {number=} radius
 * @prop {number=} strokeWidth
 * @prop {string} color
 */

 
 


/**
 * @typedef {Object} setInfo
 * @prop {modelInfo} modelInfo
 * @prop {Array.<connectInfo>} connectInfoList
 */

/**
 * @typedef {Object} modelInfo
 * @prop {Array.<deviceModel>} waterDoor
 * @prop {Array.<deviceModel>} valve
 * @prop {Array.<deviceModel>} pump
 * @prop {Array.<deviceModel>} salinity
 * @prop {Array.<deviceModel>} waterLevel
 * @prop {Array.<deviceModel>} waterTemperature
 * @prop {Array.<deviceModel>} moduleFrontTemperature
 * @prop {Array.<deviceModel>} moduleRearTemperature
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
 * @prop {string} targetId
 * @prop {string} targetName
 * @prop {number|string} targetData
 */
//  * @prop {SalternDevice} salternRouter

/**
 * @typedef {Object} deviceRouter
 * @prop {string} targetId
 * @prop {string} targetCategory
 * @prop {string} targetProtocol
 * @prop {string} deviceId
 * @prop {string[]} nodeModelList
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




/**
 * @typedef {Object} control
 * @prop {string} cmdName 명령 이름
 * @prop {string[]} trueList
 * @prop {string[]} falseList
 */
