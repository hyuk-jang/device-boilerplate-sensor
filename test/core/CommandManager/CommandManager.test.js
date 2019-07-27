require('dotenv').config();
const _ = require('lodash');
const { expect } = require('chai');

const { BU } = require('base-util-jh');

const CommandManager = require('../../../src/core/CommandManager/CommandManager');

const CmdOverlapManager = require('../../../src/core/CommandManager/CommandOverlap/CmdOverlapManager');
const CmdOverlapStorage = require('../../../src/core/CommandManager/CommandOverlap/CmdOverlapStorage');
const CmdOverlapStatus = require('../../../src/core/CommandManager/CommandOverlap/CmdOverlapStatus');

const PlaceManager = require('../../../src/core/PlaceManager/PlaceManager');

const { wrapCmdList, nodeList, placeList, placeRelationList } = require('./config');

// Model에서 Place를 초기 설정할 메소드
function Model() {
  this.nodeList = nodeList;
  this.placeList = placeList;
  this.placeRelationList = placeRelationList;
  this.findDataLoggerController = nodeId => {
    return {
      requestCommand: () => {},
    };
  };
}

const CoreFacade = require('../../../src/core/CoreFacade');
const NodeUpdatorManager = require('../../../src/core/Updator/NodeUpdator/NodeUpdatorManager');

function Control() {
  const coreFacade = new CoreFacade();
  coreFacade.setControl(this);

  this.nodeList = nodeList;
  this.nodeUpdatorManager = new NodeUpdatorManager(this.nodeList);
  this.model = new Model();
}

const control = new Control();

const {
  dcmConfigModel: { reqWrapCmdType, reqDeviceControlType: reqDCT },
} = require('../../../src/core/CoreFacade');

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
      cmdStrategyType: cmdModeType,
      getCurrCmdStrategyType: () => cmdModeType.OVERLAP_COUNT,
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

describe('장소 관리', function() {
  /**
   * 1. Place Manager Tree를 구성한다.
   * 2. Manager, Storage, Node 메소드가 잘 작동하는지 확인
   * 3. Control Mode가 변경되었을 경우 모든 Tree 구조의 말단까지 전파가 잘 되는지 확인
   * 4. Node Updator 에 각 노드들을 옵저버로 등록하고 데이터를 수신 받는지 테스트
   */
  it('PlaceStorage', function() {
    // 1. Place Manager Tree를 구성한다.
    const placeManager = new PlaceManager();
    placeManager.init(new Model());

    // * 1. Place Manager Tree를 구성한다.
    // 장소는 총 4개. 중복 1개(SEB_1), Node 객체 연결 없는 장소 1개(WW_017).
    // 따라서 2개여야 함
    expect(placeManager.placeStorageList).to.length(2);

    // 수중 증발지 1 저장소 객체를
    const ps_SEB_1 = placeManager.findPlace('SEB_1');
    const pn_WL_SEB_1 = ps_SEB_1.getPlaceNode('waterLevel');

    // 수중 태양광 1은 센서 4개(S_002, WL_008, MRT_001, BT_001)로 이루어짐
    expect(ps_SEB_1.children).to.length(4);
    expect(ps_SEB_1.getPlaceId()).to.eq('SEB_1');

    // 염도 상한선 10.5도
    console.log(ps_SEB_1.getPlaceNode('salinity'));
    expect(ps_SEB_1.getPlaceNode('salinity').getUpperLimitValue()).to.eq(10.5);
    // 수위 하한선 2.9 cm
    expect(ps_SEB_1.getPlaceNode('waterLevel').getLowerLimitValue()).to.eq(2.9);

    // 수중 태양광 2는 센서 3개(S_003, WL_009, MRT_002)로 이루어짐
    expect(placeManager.getPlaceStorage('SEB_2').children).to.length(3);
  });
});

describe.only('명령 관리', function() {
  it('명령 생성', async () => {
    const cmdMan = new CommandManager(new Model());

    const A_TO_B_CON = _.head(wrapCmdList);
    const A_TO_C_CON = _.nth(wrapCmdList, 1);
    const B_TO_A_CON = _.nth(wrapCmdList, 2);

    // BU.CLIN(A_TO_B_CON);
    // 명령 생성 테스트
    cmdMan.executeCommand(A_TO_B_CON);
    expect(cmdMan.commandList).to.length(1);

    // 명령 조회 테스트
    const Cs_A_TO_B_CON = cmdMan.getCmdStorage(A_TO_B_CON);
    expect(Cs_A_TO_B_CON.getCmdWrapInfo()).to.deep.eq(A_TO_B_CON);

    // 명령 Ele 조회 테스트
    const cmdElement = Cs_A_TO_B_CON.cmdElements[0];

    // Cmd Element UUId 만으로 조회 성공
    expect(cmdMan.getCmdEle(cmdElement.cmdEleUuid)).to.deep.eq(cmdElement);

    expect(Cs_A_TO_B_CON.cmdElements).to.length(3);
  });
});
