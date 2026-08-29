import { toImagePath } from 'src/adapters/persistence/repositories/music-track/music-track.mapper';
import type { PrismaMusicTrackWithRelations } from 'src/adapters/persistence/repositories/music-track/music-track.mapper';

function makeRow(
  imageSearches: PrismaMusicTrackWithRelations['imageSearches'],
): PrismaMusicTrackWithRelations {
  return { id: 'track-1', imageSearches } as PrismaMusicTrackWithRelations;
}

describe('toImagePath', () => {
  it('returns the track id when a stored cover exists (imageMimeType set)', () => {
    const row = makeRow([
      {
        id: 'is-1',
        imagePath: '/ai/muzo/images/x.jpg',
        imageUrl: null,
        imageMimeType: 'image/jpeg',
        source: 'embedded',
      },
    ]);

    expect(toImagePath(row)).toBe('track-1');
  });

  it('returns undefined when an image search row exists but has no stored bytes', () => {
    const row = makeRow([
      {
        id: 'is-1',
        imagePath: '/ai/muzo/images/x.jpg',
        imageUrl: 'https://example.com/x.jpg',
        imageMimeType: null,
        source: 'apple_music',
      },
    ]);

    expect(toImagePath(row)).toBeUndefined();
  });

  it('returns undefined when there are no image searches', () => {
    expect(toImagePath(makeRow([]))).toBeUndefined();
    expect(toImagePath(makeRow(null))).toBeUndefined();
  });
});
