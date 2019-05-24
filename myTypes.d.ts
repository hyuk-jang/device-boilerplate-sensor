import MainControl from './src/Control';
import Model from './src/Model';
import CommandManager from './src/core/CommandManager/CommandManager';
import DataLoggerControl from './DataLoggerController/src/Control';

declare global {
  const MainControl: MainControl;
  const Model: Model;
  const CommandManager: CommandManager;
  const DataLoggerControl: DataLoggerControl;
}
