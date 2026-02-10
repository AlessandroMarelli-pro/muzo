import { Injectable } from '@nestjs/common';
import pino from 'pino';
import { ILogger } from 'src/clean-arch/application/ports/infrastructure/ILogger';
import { ILoggerFactory } from 'src/clean-arch/application/ports/infrastructure/ILoggerFactory';
import { NestjsLoggerAdapter } from './nestjs-logger.adapter';

@Injectable()
export class NestjsLoggerFactory implements ILoggerFactory {
  private readonly root: pino.Logger = pino({
    level: process.env['LOG_LEVEL'] ?? 'info',
  });

  createLogger(name: string): ILogger {
    const child = this.root.child({ className: name });
    return new NestjsLoggerAdapter(child, name);
  }
}
