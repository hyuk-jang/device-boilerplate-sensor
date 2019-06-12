// singleton 패턴 적용을 위한 인스턴스 변수
let instance;

class CoreFacade {
  constructor() {
    // 이미 선언한 적이 있다면 반환
    if (instance) {
      return instance;
    }

    // 현재 this를 instance에 지정
    instance = this;

    this.cmdManager;
    this.cmdExecManager;
  }

  /**
   * 명령 관리자 정의
   * @param {CommandManager} cmdManager
   */
  setCmdManager(cmdManager) {
    this.cmdManager = cmdManager;
  }

  /**
   * 명령 실행 관리자 정의
   * @param {CommandExecManager} cmdExecManager
   */
  setCmdExecManager(cmdExecManager) {
    this.cmdExecManager = cmdExecManager;
  }
}

module.exports = CoreFacade;
