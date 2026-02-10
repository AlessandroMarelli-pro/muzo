import { Global, Module } from '@nestjs/common';
import { LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { NestjsLoggerFactory } from './nestjs-logger.factory';

@Global()
@Module({
  providers: [
    {
      provide: LOGGER,
      useFactory: (factory: NestjsLoggerFactory) =>
        factory.createLogger('Application'),
      inject: [LOGGER_FACTORY],
    },
    {
      provide: LOGGER_FACTORY,
      useClass: NestjsLoggerFactory,
    },
  ],
  exports: [LOGGER, LOGGER_FACTORY],
})
export class NestjsLoggerModule {}
