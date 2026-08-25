import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { AUDIO_SCAN_SCHEDULER_CONSUMER } from 'src/application/ports/infrastructure/IAudioScanSchedulerConsumer';
import { AUDIO_SCAN_SCHEDULER_PRODUCER } from 'src/application/ports/infrastructure/IAudioScanSchedulerProducer';
import { EMBEDDING_BACKFILL_PRODUCER } from 'src/application/ports/infrastructure/IEmbeddingBackfillProducer';
import { HQ_AUDIO_ACQUIRE_PRODUCER } from 'src/application/ports/infrastructure/IHqAudioAcquireProducer';
import { HQ_AUDIO_BATCH_ACQUIRE_PRODUCER } from 'src/application/ports/infrastructure/IHqAudioBatchAcquireProducer';
import { HQ_AUDIO_ENHANCE_PRODUCER } from 'src/application/ports/infrastructure/IHqAudioEnhanceProducer';
import { LIBRARY_SCAN_SCHEDULER_CONSUMER } from 'src/application/ports/infrastructure/ILibraryScanSchedulerConsumer';
import { LIBRARY_SCAN_SCHEDULER_PRODUCER } from 'src/application/ports/infrastructure/ILibraryScanSchedulerProducer';
import { UseCasesModule } from 'src/application/use-cases/use-cases.module';
import { AudioScanSchedulerProducerAdapter } from 'src/infrastructure/job-scheduler/audio-scan-scheduler-producer.adapter';
import { EmbeddingBackfillProducerAdapter } from 'src/infrastructure/job-scheduler/embedding-backfill-producer.adapter';
import { HqAudioAcquireProducerAdapter } from 'src/infrastructure/job-scheduler/hq-audio-acquire-producer.adapter';
import { HqAudioBatchAcquireProducerAdapter } from 'src/infrastructure/job-scheduler/hq-audio-batch-acquire-producer.adapter';
import { HqAudioEnhanceProducerAdapter } from 'src/infrastructure/job-scheduler/hq-audio-enhance-producer.adapter';
import { LibraryScanSchedulerProducerAdapter } from 'src/infrastructure/job-scheduler/library-scan-scheduler-producer.adapter';
import { AudioScanSchedulerConsumerAdapter } from './audio-scan-scheduler-consumer.adapter';
import { EmbeddingBackfillConsumerAdapter } from './embedding-backfill-consumer.adapter';
import { HqAudioAcquireConsumerAdapter } from './hq-audio-acquire-consumer.adapter';
import { HqAudioBatchAcquireConsumerAdapter } from './hq-audio-batch-acquire-consumer.adapter';
import { HqAudioEnhanceConsumerAdapter } from './hq-audio-enhance-consumer.adapter';
import { LibraryScanSchedulerConsumerAdapter } from './library-scan-scheduler-consumer.adapter';

const providers = [
  {
    provide: LIBRARY_SCAN_SCHEDULER_PRODUCER,
    useClass: LibraryScanSchedulerProducerAdapter,
  },
  {
    provide: LIBRARY_SCAN_SCHEDULER_CONSUMER,
    useClass: LibraryScanSchedulerConsumerAdapter,
  },
  {
    provide: AUDIO_SCAN_SCHEDULER_CONSUMER,
    useClass: AudioScanSchedulerConsumerAdapter,
  },
  {
    provide: AUDIO_SCAN_SCHEDULER_PRODUCER,
    useClass: AudioScanSchedulerProducerAdapter,
  },
  {
    provide: HQ_AUDIO_ACQUIRE_PRODUCER,
    useClass: HqAudioAcquireProducerAdapter,
  },
  HqAudioAcquireConsumerAdapter,
  {
    provide: HQ_AUDIO_BATCH_ACQUIRE_PRODUCER,
    useClass: HqAudioBatchAcquireProducerAdapter,
  },
  HqAudioBatchAcquireConsumerAdapter,
  {
    provide: HQ_AUDIO_ENHANCE_PRODUCER,
    useClass: HqAudioEnhanceProducerAdapter,
  },
  HqAudioEnhanceConsumerAdapter,
  {
    provide: EMBEDDING_BACKFILL_PRODUCER,
    useClass: EmbeddingBackfillProducerAdapter,
  },
  EmbeddingBackfillConsumerAdapter,
];

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'library-scan' },
      { name: 'audio-scan' },
      { name: 'hq-audio-acquire' },
      { name: 'hq-audio-batch-acquire' },
      { name: 'hq-audio-enhance' },
      { name: 'embedding-backfill' },
    ),
    UseCasesModule,
  ],
  providers,
  exports: [
    LIBRARY_SCAN_SCHEDULER_PRODUCER,
    LIBRARY_SCAN_SCHEDULER_CONSUMER,
    AUDIO_SCAN_SCHEDULER_CONSUMER,
    AUDIO_SCAN_SCHEDULER_PRODUCER,
    HQ_AUDIO_ACQUIRE_PRODUCER,
    HQ_AUDIO_BATCH_ACQUIRE_PRODUCER,
    HQ_AUDIO_ENHANCE_PRODUCER,
    EMBEDDING_BACKFILL_PRODUCER,
  ],
})
export class JobSchedulersModule {}
