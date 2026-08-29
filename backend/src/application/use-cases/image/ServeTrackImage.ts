import { MusicTrackId } from 'src/kernel/ids';
import {
  IImageSearchRepository,
  TrackImage,
} from '../../ports/repositories/IImageSearchRepository';

export class ServeTrackImageUseCase {
  constructor(private readonly imageSearchRepository: IImageSearchRepository) {}

  async execute(trackId: MusicTrackId): Promise<TrackImage | null> {
    return this.imageSearchRepository.findLatestImageForTrack(trackId);
  }
}
