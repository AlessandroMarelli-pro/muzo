import { ActionContext } from './model-types';

export const LOG_LEVELS = {
  INFO: 'info',
  ERROR: 'error',
  WARN: 'warn',
  DEBUG: 'debug',
} as const;
export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

export type LoggingContext = {
  user: ActionContext['user'];
};
