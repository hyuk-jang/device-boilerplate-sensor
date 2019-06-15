import MainControl from './src/Control';
import Model from './src/Model';
import CoreFacade from './src/core/CoreFacade';
import CommandExecManager from './src/CommandExecManager';
import PlaceManager from './src/core/PlaceManager/PlaceManager';
import CmdStrategy from './src/core/CommandManager/CommandStrategy/CmdStrategy';
import CommandManager from './src/core/CommandManager/CommandManager';
import DataLoggerControl from './DataLoggerController/src/Control';

declare global {
  const MainControl: MainControl;
  const Model: Model;
  const CoreFacade: CoreFacade;
  const CommandExecManager: CommandExecManager;
  const CommandManager: CommandManager;
  const PlaceManager: PlaceManager;
  const CmdStrategy: CmdStrategy;
  const DataLoggerControl: DataLoggerControl;
}
