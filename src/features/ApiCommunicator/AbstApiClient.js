const { BU } = require('base-util-jh');

const DeviceManager = require('../../utils/DeviceManager');

const { dpc } = require('../../module');

const {
  BaseModel: { defaultModule },
} = dpc;

class AbstApiClient extends DeviceManager {
  /** @param {MainControl} controller */
  constructor(controller) {
    super();
    this.controller = controller;
    /** 기본 Encoding, Decondig 처리를 할 라이브러리 */
    this.defaultConverter = defaultModule;
    // socket Client의 인증 여부
    this.hasCertification = false;
  }

  /** @param {MainControl} controller */
  setControl(controller) {
    this.controller = controller;
  }

  /**
   * 장치로부터 데이터 수신
   * @override
   * @param {bufData} bufData 현재 장비에서 실행되고 있는 명령 객체
   */
  onData(bufData) {}

  /**
   * 초기 구동 개시
   */
  startOperation() {}

  /**
   * Device Controller에서 새로운 이벤트가 발생되었을 경우 알림
   * @param {string} eventName 'dcConnect' 연결, 'dcClose' 닫힘, 'dcError' 에러
   */
  onEvent(eventName) {}

  /**
   * @desc DataLogger --> Server 데이터 보고. (보고에 관한 추적은 하지 않으므로 onData 메소드에서 별도의 처리는 하지 않음)
   * DataLogger Default 명령을 내리기 위함
   * @param {transDataToServerInfo} transDataToServerInfo
   */
  transmitDataToServer(transDataToServerInfo) {}

  /**
   * 서버로 현재 진행중인 데이터(노드, 명령)를 보내줌
   */
  transmitStorageDataToServer() {}

  /**
   * @desc Server --> DataLogger 명령 수행 요청 처리
   * 수신받은 데이터가 명령 요청인지 체크하고 맞다면 명령을 수행
   * @param {defaultFormatToRequest} dataInfo
   */
  interpretRequestedCommand(dataInfo) {}
}
module.exports = AbstApiClient;
