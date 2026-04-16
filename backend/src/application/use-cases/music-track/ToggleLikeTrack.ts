import {
  HQ_AUDIO_ACQUIRE_PRODUCER,
  IHqAudioAcquireProducer,
} from 'src/application/ports/infrastructure/IHqAudioAcquireProducer';
import { MusicTrackId } from 'src/kernel/ids';
import { getCurrentUser } from 'src/kernel/types/context';
import { MusicTrack } from 'src/kernel/types/model-types';
import { Inject } from '@nestjs/common';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class ToggleLikeUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    @Inject(HQ_AUDIO_ACQUIRE_PRODUCER)
    private readonly hqAudioAcquireProducer: IHqAudioAcquireProducer,
  ) {}

  async execute(id: MusicTrackId): Promise<MusicTrack> {
    const updated = await this.musicTrackRepository.updateOneById(id, {
      stats: { isLiked: true },
    });
    await this.hqAudioAcquireProducer.scheduleHqAudioAcquire(id, getCurrentUser());
    return updated;
  }
}
