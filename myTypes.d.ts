import MainControl from './src/Control';
import DataLoggerControl from './DataLoggerController/src/Control';

declare global {
  const MainControl: MainControl;
  const DataLoggerControl: DataLoggerControl;
}
