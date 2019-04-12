class AbstCriticalState {
  constructor() {
    this.isProgress = false;
  }

  /**
   * @interface
   * 갱신된 상태에 대한 각 State 별로 처리
   */
  changedState() {}
}

const MaxOverState = class extends AbstCriticalState {};
const UpperLimitOverState = class extends AbstCriticalState {};
const NormalState = class extends AbstCriticalState {};
const LowerLimitUnderState = class extends AbstCriticalState {};
const MinUnderState = class extends AbstCriticalState {};
const UnknownState = class extends AbstCriticalState {};
const ErrorState = class extends AbstCriticalState {};

module.exports = {
  AbstCriticalState,
  MaxOverState,
  UpperLimitOverState,
  NormalState,
  LowerLimitUnderState,
  MinUnderState,
  UnknownState,
  ErrorState,
};
