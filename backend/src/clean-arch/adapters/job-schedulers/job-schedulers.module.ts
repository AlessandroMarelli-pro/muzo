import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { AUDIO_SCAN_SCHEDULER_CONSUMER } from 'src/clean-arch/application/ports/infrastructure/IAudioScanSchedulerConsumer';
import { AUDIO_SCAN_SCHEDULER_PRODUCER } from 'src/clean-arch/application/ports/infrastructure/IAudioScanSchedulerProducer';
import { LIBRARY_SCAN_SCHEDULER_CONSUMER } from 'src/clean-arch/application/ports/infrastructure/ILibraryScanSchedulerConsumer';
import { LIBRARY_SCAN_SCHEDULER_PRODUCER } from 'src/clean-arch/application/ports/infrastructure/ILibraryScanSchedulerProducer';
import { UseCasesModule } from 'src/clean-arch/application/use-cases/use-cases.module';
import { AudioScanSchedulerProducerAdapter } from 'src/clean-arch/infrastructure/job-scheduler/audio-scan-scheduler-producer.adapter';
import { LibraryScanSchedulerProducerAdapter } from 'src/clean-arch/infrastructure/job-scheduler/library-scan-scheduler-producer.adapter';
import { AudioScanSchedulerConsumerAdapter } from './audio-scan-scheduler-consumer.adapter';
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
];

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: 'library-scan' }, { name: 'audio-scan' }),
    UseCasesModule,
  ],
  providers,
  exports: providers.map((provider) => provider.provide),
})
export class JobSchedulersModule {}
