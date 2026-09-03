import {
  HqStatusTrack,
  isLosslessExtension,
  isLosslessFormat,
  isTrackAlreadyHq,
} from 'src/application/use-cases/music-track/hq-audio-status';

function track(overrides: Partial<HqStatusTrack> & { filePath?: string }): HqStatusTrack {
  const { filePath = '/music/song.mp3', ...rest } = overrides;
  return {
    fileInfo: { filePath },
    ...rest,
  };
}

describe('isLosslessExtension', () => {
  it.each(['/a/b.flac', 'song.wav', 'X.AIFF', 'y.aif', 'flac'])('is true for %s', (value) => {
    expect(isLosslessExtension(value)).toBe(true);
  });

  it.each(['/a/b.mp3', 'song.m4a', 'y.ogg', '', null, undefined])(
    'is false for %s',
    (value) => {
      expect(isLosslessExtension(value)).toBe(false);
    },
  );
});

describe('isLosslessFormat', () => {
  it.each(['flac', 'FLAC', 'wav', 'aiff'])('is true for %s', (value) => {
    expect(isLosslessFormat(value)).toBe(true);
  });

  it.each(['mp3', 'aac', '', null, undefined])('is false for %s', (value) => {
    expect(isLosslessFormat(value)).toBe(false);
  });
});

describe('isTrackAlreadyHq', () => {
  it('is true when hqAudioPath is set', () => {
    expect(isTrackAlreadyHq(track({ hqAudioPath: '/hq/song.flac' }))).toBe(true);
  });

  it('is true when the original file is a lossless container', () => {
    expect(isTrackAlreadyHq(track({ filePath: '/music/song.flac' }))).toBe(true);
  });

  it('is true when technicalInfo.format is lossless even if the extension is not', () => {
    expect(
      isTrackAlreadyHq(track({ filePath: '/music/song.mp3', technicalInfo: { format: 'FLAC' } })),
    ).toBe(true);
  });

  it('is false for a plain lossy track with no hqAudioPath', () => {
    expect(
      isTrackAlreadyHq(track({ filePath: '/music/song.mp3', technicalInfo: { format: 'mp3' } })),
    ).toBe(false);
  });

  it('is false when technicalInfo is missing and the file is lossy', () => {
    expect(isTrackAlreadyHq(track({ filePath: '/music/song.aac' }))).toBe(false);
  });
});
