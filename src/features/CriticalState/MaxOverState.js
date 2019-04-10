const CriticalState = require('./CriticalState');

exports.MaxOverState = class extends CriticalState {};
exports.UpperLimitOverState = class extends CriticalState {};
exports.NormalState = class extends CriticalState {};
exports.LowerLimitUnderState = class extends CriticalState {};
exports.MinUnderState = class extends CriticalState {};
