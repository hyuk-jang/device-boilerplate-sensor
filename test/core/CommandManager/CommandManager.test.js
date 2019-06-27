require('dotenv').config();
const _ = require('lodash');
const { expect } = require('chai');

const { BU } = require('base-util-jh');

const CmdOverlapManager = require('../../../src/core/CommandManager/CommandOverlap/CmdOverlapManager');
const CmdOverlapStorage = require('../../../src/core/CommandManager/CommandOverlap/CmdOverlapStorage');
const CmdOverlapStatus = require('../../../src/core/CommandManager/CommandOverlap/CmdOverlapStatus');

const { wrapCmdList, nodeList } = require('./config');

const {
  dcmConfigModel: { reqWrapCmdType, reqDeviceControlType: reqDCT },
} = require('../../../../default-intelligence');

const cmdModeType = {
  MANUAL: 'MANUAL',
  OVERLAP_COUNT: 'OVERLAP_COUNT',
};

describe('CmdOverlap', function() {
  it('CmdOverlapStorage', function() {
    const stat1 = new CmdOverlapStatus(reqDCT.TRUE);
    stat1.addOverlapWCU('one');
    stat1.addOverlapWCU('two');
    const stat2 = new CmdOverlapStatus(reqDCT.FALSE);
    stat2.addOverlapWCU('three');
    stat2.addOverlapWCU('four');

    const cmdOverlapStorage = new CmdOverlapStorage({
      node_id: 'TEST',
    });

    expect(cmdOverlapStorage.children).to.length(0);
    cmdOverlapStorage.addOverlapStatus(stat1);
    expect(cmdOverlapStorage.children).to.length(1);
    cmdOverlapStorage.addOverlapStatus(stat2);
    expect(cmdOverlapStorage.children).to.length(2);
    cmdOverlapStorage.addOverlapStatus(stat1);
    cmdOverlapStorage.addOverlapStatus(stat2);
    // 동일한 자식 객체가 존재하기 때문에 2개
    expect(cmdOverlapStorage.children).to.length(2);

    // 아무런 옵션을 주지 않았을 경우에는 4건
    const resultNoOption = cmdOverlapStorage.getExistWcuListExceptOption();
    const resultTrueOption = cmdOverlapStorage.getExistWcuListExceptOption(reqDCT.TRUE);
    const resultFalseOption = cmdOverlapStorage.getExistWcuListExceptOption(reqDCT.FALSE);
    const resultMeasureOption = cmdOverlapStorage.getExistWcuListExceptOption(reqDCT.MEASURE);

    expect(resultNoOption.overlapStatusList).to.length(2);

    // 옵션을 주지않았을때와 존재하지 않는 옵션 2를 주었을 경우에 결과값은 동일해야하며 옵션 1과는 달라야한다.
    expect(resultNoOption)
      .to.deep.eq(resultMeasureOption)
      .to.not.deep.eq(resultFalseOption);

    expect(_.head(resultFalseOption.overlapStatusList).getOverlapWCUs()).to.deep.eq(['one', 'two']);
    expect(_.head(resultTrueOption.overlapStatusList).getOverlapWCUs()).to.deep.eq([
      'three',
      'four',
    ]);
  });

  it('CmdOverlapManager', function() {
    // 명령 임계치 매니저 생성
    const cmdOverlapManager = new CmdOverlapManager({
      nodeList,
      cmdModeType,
      getCurrCmdMode: () => cmdModeType.OVERLAP_COUNT,
    });

    const A_TO_B = _.find(wrapCmdList, { wrapCmdId: 'A_TO_B' });
    const A_TO_C = _.find(wrapCmdList, { wrapCmdId: 'A_TO_C' });
    const B_TO_A = _.find(wrapCmdList, { wrapCmdId: 'B_TO_A' });

    cmdOverlapManager.isConflictCommand(A_TO_B);
    cmdOverlapManager.updateOverlapCmdWrapInfo(A_TO_B);

    const WD_001_Storage = cmdOverlapManager.getOverlapStorage('WD_001');
    const WD_002_Storage = cmdOverlapManager.getOverlapStorage('WD_002');
    const WD_003_Storage = cmdOverlapManager.getOverlapStorage('WD_003');
    const WD_004_Storage = cmdOverlapManager.getOverlapStorage('WD_004');

    // 수문 1번의 닫는 누적 명령에는 A_TO_B가 있어야함
    expect(WD_001_Storage.getOverlapStatus(reqDCT.FALSE).getOverlapWCUs()).to.deep.eq(['A_TO_B']);
    expect(WD_001_Storage.getOverlapStatus(reqDCT.TRUE).getOverlapWCUs()).to.deep.eq([]);
    expect(WD_001_Storage.getOverlapStatus(reqDCT.FALSE).reservedEleCmdUuid).to.deep.eq(
      'WD_001_UUID',
    );
    expect(WD_002_Storage.getOverlapStatus(reqDCT.FALSE).getOverlapWCUs()).to.deep.eq(['A_TO_B']);
    expect(WD_003_Storage.getOverlapStatus(reqDCT.TRUE).getOverlapWCUs()).to.deep.eq(['A_TO_B']);

    cmdOverlapManager.isConflictCommand(A_TO_C);
    cmdOverlapManager.updateOverlapCmdWrapInfo(A_TO_C);

    expect(WD_001_Storage.getOverlapStatus(reqDCT.FALSE).getOverlapWCUs()).to.deep.eq([
      'A_TO_B',
      'A_TO_C',
    ]);

    expect(WD_004_Storage.getOverlapStatus(reqDCT.TRUE).getOverlapWCUs()).to.deep.eq(['A_TO_C']);

    // // BU.CLI(cmdOverlapManager.isConflictCommand(B_TO_A));
    // A_TO_B 동일한 요청을 할 경우 동일한 WCU가 존재하기 때문에 실행 불가
    expect(() => cmdOverlapManager.isConflictCommand(A_TO_B)).to.throw(
      'A node(WD_001) same WCU(A_TO_B) already exists.',
    );
    // A_TO_B 의 WD_003번은 TRUE로 누적에 포함되어 있기 때문에 충돌 발생
    expect(() => cmdOverlapManager.isConflictCommand(B_TO_A)).to.throw(
      `Conflict of WCI(B_TO_A) SingleControlType(${reqDCT.FALSE}) of node(WD_003)`,
    );

    // 기존 명령 취소로 변경
    A_TO_B.wrapCmdType = reqWrapCmdType.CANCEL;
    A_TO_C.wrapCmdType = reqWrapCmdType.CANCEL;

    cmdOverlapManager.updateOverlapCmdWrapInfo(A_TO_B);

    expect(WD_001_Storage.getOverlapStatus(reqDCT.FALSE).getOverlapWCUs()).to.deep.eq(['A_TO_C']);
    cmdOverlapManager.updateOverlapCmdWrapInfo(A_TO_C);

    // 모든 명령을 삭제하였기 때문에 누적 명령은 존재하지 않음
    expect(cmdOverlapManager.getExistOverlapStatusList()).to.length(0);
  });
});
