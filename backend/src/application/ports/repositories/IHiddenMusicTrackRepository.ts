import { HiddenMusicTrackId } from 'src/kernel/ids';
import { HiddenMusicTrack } from 'src/kernel/types/model-types';
import { PaginationResult, WithPagination } from 'src/kernel/types/pagination';
import { createToken } from '../../utils/create-token';

export const HIDDEN_MUSIC_TRACK_REPOSITORY = createToken<IHiddenMusicTrackRepository>(
  'HIDDEN_MUSIC_TRACK_REPOSITORY',
);

export type HiddenTrackImage = { data: Buffer; mimeType: string };

export interface IHiddenMusicTrackRepository {
  save(hiddenMusicTrack: HiddenMusicTrack): Promise<HiddenMusicTrack>;
  getManyWithPagination(pagination: WithPagination): Promise<PaginationResult<HiddenMusicTrack>>;
  getOneById(id: HiddenMusicTrackId): Promise<HiddenMusicTrack>;
  removeOneById(id: HiddenMusicTrackId): Promise<boolean>;
  /**
   * Unscoped by user, unlike getOneById -- the image-serving route has no
   * auth guard (plain <img> tags can't carry auth headers), so this can't
   * require a session. Mirrors IImageSearchRepository.findLatestImageForTrack.
   */
  findImageById(id: HiddenMusicTrackId): Promise<HiddenTrackImage | null>;
}
