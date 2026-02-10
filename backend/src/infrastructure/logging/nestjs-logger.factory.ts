import { Injectable } from '@nestjs/common';
import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { ILoggerFactory } from 'src/application/ports/infrastructure/ILoggerFactory';
import { NestjsLoggerAdapter } from './nestjs-logger.adapter';

@Injectable()
export class NestjsLoggerFactory implements ILoggerFactory {
  createLogger(name: string): ILogger {
    return new NestjsLoggerAdapter(name);
  }
}
