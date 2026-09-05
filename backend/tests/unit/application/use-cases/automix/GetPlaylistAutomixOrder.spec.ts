import type { IPlaylistTrackRepository } from 'src/application/ports/repositories/IPlaylistTrackRepository';
import type { PlaylistTrackWithTrackDetail } from 'src/application/ports/dtos/PlaylistTrackWithDetail';
import { GetPlaylistAutomixOrderUseCase } from 'src/application/use-cases/automix/GetPlaylistAutomixOrder';
import { models } from 'src/kernel/types/models';
import type { MusicTrack } from 'src/kernel/types/model-types';
import { describe, expect, it } from 'vitest';

const PLAYLIST_ID = models.playlist.id('playlist-1');

function embedding(...values: number[]): number[] {
  const vec = new Array(8).fill(0);
  values.forEach((v, i) => (vec[i] = v));
  return vec;
}

function track(
  id: string,
  opts: { tempo?: number | null; camelotKey?: string | null; embedding?: number[] } = {},
): MusicTrack {
  return {
    id: models.musicTrack.id(id),
    features: {
      musicalFeatures: {
        tempo: opts.tempo ?? undefined,
        camelotKey: opts.camelotKey ?? undefined,
      },
      embedding: opts.embedding,
    },
  } as unknown as MusicTrack;
}

function playlistTrack(
  id: string,
  position: number,
  musicTrack: MusicTrack,
): PlaylistTrackWithTrackDetail {
  return {
    id: models.playlistTrack.id(id),
    playlistId: PLAYLIST_ID,
    position,
    addedAt: new Date(),
    trackId: musicTrack.id,
    track: musicTrack,
  } as unknown as PlaylistTrackWithTrackDetail;
}

class FakePlaylistTrackRepository implements Partial<IPlaylistTrackRepository> {
  constructor(private readonly tracks: PlaylistTrackWithTrackDetail[]) {}

  async getTracksByPlaylistIdWithTrack(): Promise<PlaylistTrackWithTrackDetail[]> {
    return this.tracks;
  }
}

function makeUseCase(tracks: PlaylistTrackWithTrackDetail[]): GetPlaylistAutomixOrderUseCase {
  return new GetPlaylistAutomixOrderUseCase(
    new FakePlaylistTrackRepository(tracks) as IPlaylistTrackRepository,
  );
}

describe('GetPlaylistAutomixOrderUseCase', () => {
  it('returns 0/1/2-track playlists unchanged', async () => {
    expect(await makeUseCase([]).execute(PLAYLIST_ID)).toEqual([]);

    const one = [playlistTrack('a', 1, track('t-a', { tempo: 120, camelotKey: '8A' }))];
    expect(await makeUseCase(one).execute(PLAYLIST_ID)).toBe(one);

    const two = [
      playlistTrack('a', 1, track('t-a', { tempo: 120, camelotKey: '8A' })),
      playlistTrack('b', 2, track('t-b', { tempo: 90, camelotKey: '2B' })),
    ];
    expect(await makeUseCase(two).execute(PLAYLIST_ID)).toBe(two);
  });

  it('groups close BPM/key/embedding tracks together, keeping the seed first', async () => {
    const tracks = [
      playlistTrack('seed', 1, track('t-seed', { tempo: 120, camelotKey: '8A', embedding: embedding(1, 0) })),
      playlistTrack('far', 2, track('t-far', { tempo: 170, camelotKey: '3B', embedding: embedding(0, 1) })),
      playlistTrack('near1', 3, track('t-near1', { tempo: 121, camelotKey: '8A', embedding: embedding(1, 0) })),
      playlistTrack('near2', 4, track('t-near2', { tempo: 128, camelotKey: '9A', embedding: embedding(0.9, 0.1) })),
    ];
    const result = await makeUseCase(tracks).execute(PLAYLIST_ID);
    expect(result[0].id).toBe(models.playlistTrack.id('seed'));
    expect(result[result.length - 1].id).toBe(models.playlistTrack.id('far'));
  });

  it('preserves every track exactly once, including tracks missing features', async () => {
    const tracks = [
      playlistTrack('a', 1, track('t-a', { tempo: 100, camelotKey: '1A', embedding: embedding(1, 0) })),
      playlistTrack('b', 2, track('t-b', { tempo: 140, camelotKey: '6B', embedding: embedding(0, 1) })),
      playlistTrack('c', 3, track('t-c', {})),
      playlistTrack('d', 4, track('t-d', { embedding: embedding(0.5, 0.5) })),
    ];
    const result = await makeUseCase(tracks).execute(PLAYLIST_ID);
    expect(result.map((t) => t.id).sort()).toEqual(tracks.map((t) => t.id).sort());
  });

  it('does not crash on tracks with fully-missing features', async () => {
    const tracks = [
      playlistTrack('a', 1, track('t-a', {})),
      playlistTrack('b', 2, track('t-b', {})),
      playlistTrack('c', 3, track('t-c', {})),
    ];
    const result = await makeUseCase(tracks).execute(PLAYLIST_ID);
    expect(result).toHaveLength(3);
  });

  it('seeds from a specific PlaylistTrackId when given', async () => {
    const tracks = [
      playlistTrack('a', 1, track('t-a', { tempo: 120, camelotKey: '8A' })),
      playlistTrack('seed', 2, track('t-seed', { tempo: 121, camelotKey: '8A' })),
      playlistTrack('c', 3, track('t-c', { tempo: 170, camelotKey: '3B' })),
    ];
    const result = await makeUseCase(tracks).execute(PLAYLIST_ID, models.playlistTrack.id('seed'));
    expect(result[0].id).toBe(models.playlistTrack.id('seed'));
    expect(result.map((t) => t.id).sort()).toEqual(tracks.map((t) => t.id).sort());
  });

  it('falls back to the first track when seedTrackId is unknown', async () => {
    const tracks = [
      playlistTrack('a', 1, track('t-a', { tempo: 120, camelotKey: '8A' })),
      playlistTrack('b', 2, track('t-b', { tempo: 121, camelotKey: '8A' })),
    ];
    const result = await makeUseCase(tracks).execute(
      PLAYLIST_ID,
      models.playlistTrack.id('missing'),
    );
    expect(result).toBe(tracks);
  });
});
