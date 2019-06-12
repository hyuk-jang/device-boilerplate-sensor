import MainControl from './src/Control';
import Model from './src/Model';
import CommandExecManager from './src/CommandExecManager';
import CmdStrategy from './src/core/CommandManager/CommandStrategy/CmdStrategy';
import CommandManager from './src/core/CommandManager/CommandManager';
import DataLoggerControl from './DataLoggerController/src/Control';

declare global {
  const MainControl: MainControl;
  const Model: Model;
  const CommandExecManager: CommandExecManager;
  const CommandManager: CommandManager;
  const CmdStrategy: CmdStrategy;
  const DataLoggerControl: DataLoggerControl;
}
