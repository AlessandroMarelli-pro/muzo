import { buildAudioTagMetadata } from 'src/application/use-cases/music-track/audio-tag-metadata';
import type { MusicTrack } from 'src/kernel/types/model-types';

function track(overrides: Partial<MusicTrack>): MusicTrack {
  return {
    artist: 'daft punk',
    title: 'around the world',
    metadata: { genres: ['House'], subgenres: ['French House', 'Nu-Disco'] },
    ...overrides,
  } as MusicTrack;
}

describe('buildAudioTagMetadata', () => {
  it('capitalizes artist/title and builds hashtag genre/style/comment', () => {
    const md = buildAudioTagMetadata(track({}));
    expect(md.artist).toBe('Daft Punk');
    expect(md.title).toBe('Around The World');
    expect(md.genre).toBe('#french house, #nu-disco');
    expect(md.style).toBe(md.genre);
    expect(md.comment).toBe('#house');
  });

  it('falls back to Unknown for blank artist/title', () => {
    const md = buildAudioTagMetadata(track({ artist: '  ', title: undefined }));
    expect(md.artist).toBe('Unknown');
    expect(md.title).toBe('Unknown');
  });

  it('emits empty strings when no genres/subgenres', () => {
    const md = buildAudioTagMetadata(track({ metadata: undefined }));
    expect(md.genre).toBe('');
    expect(md.comment).toBe('');
  });
});
