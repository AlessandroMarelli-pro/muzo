import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueConfig } from '../../config';
import { SharedModule } from '../../shared/shared.module';
import { AiIntegrationService } from './ai-integration.service';

@Module({
  imports: [
    SharedModule,
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const queueConfig = configService.get<QueueConfig>('queue');
        return {
          connection: {
            host: queueConfig.redis.host,
            port: queueConfig.redis.port,
            password: queueConfig.redis.password,
            db: queueConfig.redis.db,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'library-scan',
    }),
  ],
  providers: [AiIntegrationService],
  exports: [AiIntegrationService],
})
export class AiIntegrationModule {}
