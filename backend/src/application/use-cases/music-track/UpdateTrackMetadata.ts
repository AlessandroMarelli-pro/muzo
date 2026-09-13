import { MusicTrackId } from 'src/kernel/ids';
import { MusicTrack } from 'src/kernel/types/model-types';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class UpdateTrackMetadataUseCase {
  constructor(private readonly musicTrackRepository: IMusicTrackRepository) {}

  async execute(id: MusicTrackId, artist: string, title: string): Promise<MusicTrack> {
    return this.musicTrackRepository.updateOneById(id, {
      artist,
      title,
      metadataManuallyEdited: true,
    });
  }
}
