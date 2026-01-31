import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { MusicTrack } from 'src/clean-arch/kernel/types/model-types';

export interface IMusicTrackRepository {
  getOneById(id: MusicTrackId): Promise<MusicTrack>;
}
