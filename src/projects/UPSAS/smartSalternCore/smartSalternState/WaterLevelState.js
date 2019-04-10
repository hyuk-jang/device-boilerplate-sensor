const CriticalState = require('../../../../features/CriticalState/CriticalState');

const MaxOverState = class extends CriticalState {};
const UpperLimitOverState = class extends CriticalState {};
const NormalState = class extends CriticalState {};
const LowerLimitUnderState = class extends CriticalState {};
const MinUnderState = class extends CriticalState {};
const UnknownState = class extends CriticalState {};
