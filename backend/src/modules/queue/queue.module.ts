import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueConfig } from 'src/config/queue.config';
import { FileScanningService } from 'src/shared/services/file-scanning.service';
import { UseCasesModule } from '../../clean-arch/application/use-cases/use-cases.module';
import { SharedModule } from '../../shared/shared.module';
import { AiIntegrationModule } from '../ai-integration/ai-integration.module';
import { AudioScanProcessor } from './processors/audio-scan.processor';
import { LibraryScanProcessor } from './processors/library-scan.processor';
import { ProgressTrackingService } from './progress-tracking.service';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { ScanProgressPubSubService } from './scan-progress-pubsub.service';
import { ScanProgressController } from './scan-progress.controller';
import { ScanSessionService } from './scan-session.service';

@Module({
  imports: [
    SharedModule,
    AiIntegrationModule,
    UseCasesModule,
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
    BullModule.registerQueue(
      {
        name: 'library-scan',
      },
      {
        name: 'audio-scan',
      },
      {
        name: 'bpm-update',
      },
    ),
  ],
  controllers: [QueueController, ScanProgressController],
  providers: [
    QueueService,
    LibraryScanProcessor,
    AudioScanProcessor,
    ProgressTrackingService,
    FileScanningService,
    ScanSessionService,
    ScanProgressPubSubService,
  ],
  exports: [QueueService, ProgressTrackingService, BullModule],
})
export class QueueModule {}
