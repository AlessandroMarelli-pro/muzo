import { PlaylistId, PlaylistTrackId } from 'src/kernel/ids';
import { camelotDistance } from 'src/kernel/utils/camelot-distance';
import { cosineDistance } from 'src/kernel/utils/embedding-similarity';
import { PlaylistTrackWithTrackDetail } from '../../ports/dtos/PlaylistTrackWithDetail';
import { IPlaylistTrackRepository } from '../../ports/repositories/IPlaylistTrackRepository';

// Calibration mirrors frontend/src/lib/automix.ts: BPM_SCALE=8 lines up a
// "1.0"-costing tempo jump with the app's existing >=8 BPM jarring-jump
// threshold, KEY_WEIGHT=1 puts a single Camelot step on the same footing.
// EMBED_WEIGHT boosts cosine distance (which clusters much tighter, e.g.
// 0.05-0.4, than a BPM-jump-calibrated "1.0") so it actually drives ordering
// rather than being drowned out by BPM/key -- placeholder, tune against real
// playlist data.
const BPM_SCALE = 8;
const KEY_WEIGHT = 1;
const UNKNOWN_KEY_PENALTY = 1;
const EMBED_WEIGHT = 10;

export class GetPlaylistAutomixOrderUseCase {
  constructor(private readonly playlistTrackRepository: IPlaylistTrackRepository) {}

  async execute(
    playlistId: PlaylistId,
    seedTrackId?: PlaylistTrackId,
  ): Promise<PlaylistTrackWithTrackDetail[]> {
    const tracks = await this.playlistTrackRepository.getTracksByPlaylistIdWithTrack(playlistId, {
      sortingKey: 'position',
      sortingDirection: 'asc',
    });

    if (tracks.length <= 2) {
      return tracks;
    }

    const seedIndex = seedTrackId ? tracks.findIndex((t) => t.id === seedTrackId) : 0;
    const seed = seedIndex >= 0 ? tracks[seedIndex] : tracks[0];

    const remaining = tracks.filter((t) => t.id !== seed.id);
    const ordered: PlaylistTrackWithTrackDetail[] = [seed];
    let current = seed;

    while (remaining.length > 0) {
      let bestIndex = 0;
      let bestScore = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const score = this.transitionScore(current, remaining[i]);
        if (score < bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
      current = remaining[bestIndex];
      ordered.push(current);
      remaining.splice(bestIndex, 1);
    }

    return ordered;
  }

  /** Cost of transitioning from track `a` to track `b` -- lower is smoother. */
  private transitionScore(
    a: PlaylistTrackWithTrackDetail,
    b: PlaylistTrackWithTrackDetail,
  ): number {
    const embedDist = cosineDistance(a.track.features?.embedding, b.track.features?.embedding);
    const embedScore = embedDist != null ? EMBED_WEIGHT * embedDist : 0;

    const tempoA = a.track.features?.musicalFeatures?.tempo;
    const tempoB = b.track.features?.musicalFeatures?.tempo;
    const bpmScore = tempoA != null && tempoB != null ? Math.abs(tempoA - tempoB) / BPM_SCALE : 0;

    const keyA =
      a.track.features?.musicalFeatures?.camelotKey ?? a.track.features?.musicalFeatures?.key;
    const keyB =
      b.track.features?.musicalFeatures?.camelotKey ?? b.track.features?.musicalFeatures?.key;
    const dist = camelotDistance(keyA, keyB);
    const keyScore = dist == null ? UNKNOWN_KEY_PENALTY : dist * KEY_WEIGHT;

    return embedScore + bpmScore + keyScore;
  }
}
