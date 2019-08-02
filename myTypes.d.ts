import MainControl from './src/Control';
import Model from './src/Model';
import CoreFacade from './src/core/CoreFacade';
import CommandExecManager from './src/CommandExecManager';
import CommandManager from './src/core/CommandManager/CommandManager';
import ScenarioManager from './src/core/CommandManager/ScenarioCommand/ScenarioManager';
import CmdStorage from './src/core/CommandManager/Command/CmdStorage'
import CmdStrategy from './src/core/CommandManager/CommandStrategy/CmdStrategy';
import PlaceComponent from './src/core/PlaceManager/PlaceComponent';
import PlaceStorage from './src/core/PlaceManager/PlaceStorage';
import PlaceNode from './src/core/PlaceManager/PlaceNode';
import PlaceManager from './src/core/PlaceManager/PlaceManager';
import DataLoggerControl from './DataLoggerController/src/Control';

declare global {
  const MainControl: MainControl;
  const Model: Model;
  const CoreFacade: CoreFacade;
  const CommandExecManager: CommandExecManager;
  const CommandManager: CommandManager;
  const ScenarioManager: ScenarioManager;
  const CmdStorage: CmdStorage;
  const CmdStrategy: CmdStrategy;
  const PlaceComponent: PlaceComponent;
  const PlaceStorage: PlaceStorage;
  const PlaceNode: PlaceNode;
  const PlaceManager: PlaceManager;
  const DataLoggerControl: DataLoggerControl;
}
