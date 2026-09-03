import { createToken } from '../../utils/create-token';
import type { MusicTrack } from 'src/kernel/types/model-types';

export const HQ_AUDIO_TAGGER = createToken<IHqAudioTagger>('HQ_AUDIO_TAGGER');

export interface IHqAudioTagger {
  /**
   * Writes the track's metadata + cover art into the file at `filePath`
   * in place (no re-encode). Best-effort: logs and returns on failure rather
   * than throwing, and tags without artwork if none is stored yet.
   */
  tagInPlace(filePath: string, track: MusicTrack): Promise<void>;
}
