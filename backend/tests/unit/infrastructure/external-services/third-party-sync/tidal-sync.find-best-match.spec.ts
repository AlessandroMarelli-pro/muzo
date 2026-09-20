import { TidalSyncAdapter } from 'src/infrastructure/external-services/third-party-sync/tidal-sync.adapter';

type Track = { id: string; title: string; artist: string; duration: number };

/**
 * findBestMatch is pure scoring over whatever searchTracks returns, so stub that
 * one private method and leave the rest of the adapter (HTTP, auth) untouched.
 */
function adapterReturning(tracks: Track[]): TidalSyncAdapter {
  const adapter = Object.create(TidalSyncAdapter.prototype) as TidalSyncAdapter;
  (adapter as unknown as { searchTracks: () => Promise<Track[]> }).searchTracks = () =>
    Promise.resolve(tracks);
  return adapter;
}

describe('TidalSyncAdapter.findBestMatch', () => {
  it('prefers the exact-titled original over a remix that is closer in duration', async () => {
    // Real case: source is 523s. The remix lands inside the old +/-10s window
    // (513s) while the genuine original sits just outside it (542s), so the hard
    // duration gate handed the download to the remix.
    const adapter = adapterReturning([
      { id: '5932501', title: 'Inner Warmth', artist: 'Lightscape', duration: 542 },
      {
        id: '5932502',
        title: "Inner Warmth (Phynn's Overheated Remix)",
        artist: 'Lightscape',
        duration: 513,
      },
    ]);

    const result = await adapter.findBestMatch('Lightscape', 'Inner warmth', 523, 'user-1');

    expect(result.trackId).toBe('5932501');
  });

  it('still rejects a different song by the same artist at a similar duration', async () => {
    const adapter = adapterReturning([
      { id: '999', title: 'Something Else Entirely', artist: 'Lightscape', duration: 525 },
    ]);

    const result = await adapter.findBestMatch('Lightscape', 'Inner warmth', 523, 'user-1');

    expect(result.trackId).toBeNull();
  });

  it('does not widen the window for a candidate carrying extra qualifier words', async () => {
    const adapter = adapterReturning([
      {
        id: '5932502',
        title: "Inner Warmth (Phynn's Overheated Remix)",
        artist: 'Lightscape',
        duration: 590,
      },
    ]);

    const result = await adapter.findBestMatch('Lightscape', 'Inner warmth', 523, 'user-1');

    expect(result.trackId).toBeNull();
  });
});
