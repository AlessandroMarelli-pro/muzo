import { createToken } from '../../utils/create-token';
import { ILogger } from './ILogger';

export const LOGGER_FACTORY = createToken<ILoggerFactory>('LOGGER_FACTORY');

export interface ILoggerFactory {
  createLogger(name: string): ILogger;
}
