import { DownloadPlaylistToFolderUseCase } from 'src/application/use-cases/playlist/DownloadPlaylistToFolder';
import type { ICopyAudioWithMetadata } from 'src/application/ports/infrastructure/ICopyAudioWithMetadata';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import type { IImageSearchRepository, TrackImage } from 'src/application/ports/repositories/IImageSearchRepository';
import type { IPlaylistRepository } from 'src/application/ports/repositories/IPlaylistRepository';
import type { IPlaylistSortingRepository } from 'src/application/ports/repositories/IPlaylistSortingRepository';
import { MusicTrackId, PlaylistId } from 'src/kernel/ids';
import { models } from 'src/kernel/types/models';

const noopLogger: ILogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as ILogger;

const trackId = models.musicTrack.id('track-1') as MusicTrackId;
const playlistId = models.playlist.id('playlist-1') as PlaylistId;

const { existsSyncMock } = vi.hoisted(() => ({ existsSyncMock: vi.fn() }));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: existsSyncMock,
    promises: {
      ...actual.promises,
      mkdir: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
    },
  };
});

function buildTrack(overrides: Record<string, unknown> = {}) {
  return {
    id: trackId,
    artist: 'Some Artist',
    title: 'Some Title',
    imagePath: trackId, // toImagePath encodes "has stored image" as the track id
    fileInfo: { filePath: '/library/some-artist/some-title.flac' },
    hqAudioPath: undefined,
    metadata: { genres: ['House'], subgenres: ['Deep House'] },
    ...overrides,
  };
}

describe('DownloadPlaylistToFolderUseCase', () => {
  let playlistRepository: { getOneByIdWithTracks: ReturnType<typeof vi.fn> };
  let playlistSortingRepository: { getByPlaylistId: ReturnType<typeof vi.fn> };
  let copyAudioWithMetadata: { copyAudioWithMetadata: ReturnType<typeof vi.fn> };
  let imageSearchRepository: { findLatestImageForTrack: ReturnType<typeof vi.fn> };
  let useCase: DownloadPlaylistToFolderUseCase;

  beforeEach(() => {
    existsSyncMock.mockReset().mockReturnValue(true);

    playlistSortingRepository = { getByPlaylistId: vi.fn().mockResolvedValue(undefined) };
    copyAudioWithMetadata = { copyAudioWithMetadata: vi.fn().mockResolvedValue(undefined) };
    imageSearchRepository = { findLatestImageForTrack: vi.fn().mockResolvedValue(null) };
    playlistRepository = {
      getOneByIdWithTracks: vi.fn().mockResolvedValue({
        name: 'My Playlist',
        tracks: [{ track: buildTrack() }],
      }),
    };

    useCase = new DownloadPlaylistToFolderUseCase(
      playlistRepository as unknown as IPlaylistRepository,
      playlistSortingRepository as unknown as IPlaylistSortingRepository,
      copyAudioWithMetadata as unknown as ICopyAudioWithMetadata,
      imageSearchRepository as unknown as IImageSearchRepository,
      { createLogger: () => noopLogger },
      noopLogger,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches artwork bytes via the repository using track.id, not track.imagePath', async () => {
    const image: TrackImage = { data: Buffer.from('fake-jpeg-bytes'), mimeType: 'image/jpeg' };
    imageSearchRepository.findLatestImageForTrack.mockResolvedValue(image);

    const result = await useCase.execute(playlistId);

    expect(result).toBe(true);
    expect(imageSearchRepository.findLatestImageForTrack).toHaveBeenCalledWith(trackId);
    expect(copyAudioWithMetadata.copyAudioWithMetadata).toHaveBeenCalledTimes(1);
    const [, , , artwork] = copyAudioWithMetadata.copyAudioWithMetadata.mock.calls[0];
    expect(artwork).toEqual(image);
  });

  it('passes undefined artwork when the repository has no stored image', async () => {
    imageSearchRepository.findLatestImageForTrack.mockResolvedValue(null);

    const result = await useCase.execute(playlistId);

    expect(result).toBe(true);
    const [, , , artwork] = copyAudioWithMetadata.copyAudioWithMetadata.mock.calls[0];
    expect(artwork).toBeUndefined();
  });

  it('does not fetch artwork when the track has no stored image at all', async () => {
    playlistRepository.getOneByIdWithTracks.mockResolvedValue({
      name: 'My Playlist',
      tracks: [{ track: buildTrack({ imagePath: undefined }) }],
    });

    await useCase.execute(playlistId);

    expect(imageSearchRepository.findLatestImageForTrack).not.toHaveBeenCalled();
    const [, , , artwork] = copyAudioWithMetadata.copyAudioWithMetadata.mock.calls[0];
    expect(artwork).toBeUndefined();
  });

  it('does not abort the export when the image repository throws', async () => {
    imageSearchRepository.findLatestImageForTrack.mockRejectedValue(new Error('db down'));

    const result = await useCase.execute(playlistId);

    expect(result).toBe(true);
    const [, , , artwork] = copyAudioWithMetadata.copyAudioWithMetadata.mock.calls[0];
    expect(artwork).toBeUndefined();
  });

  it('retries without artwork when copying with artwork fails, and still succeeds', async () => {
    const image: TrackImage = { data: Buffer.from('fake-jpeg-bytes'), mimeType: 'image/jpeg' };
    imageSearchRepository.findLatestImageForTrack.mockResolvedValue(image);
    copyAudioWithMetadata.copyAudioWithMetadata
      .mockRejectedValueOnce(new Error('ffmpeg exited with code 1'))
      .mockResolvedValueOnce(undefined);

    const result = await useCase.execute(playlistId);

    expect(result).toBe(true);
    expect(copyAudioWithMetadata.copyAudioWithMetadata).toHaveBeenCalledTimes(2);
    const [, , , firstArtwork] = copyAudioWithMetadata.copyAudioWithMetadata.mock.calls[0];
    const [, , , secondArtwork] = copyAudioWithMetadata.copyAudioWithMetadata.mock.calls[1];
    expect(firstArtwork).toEqual(image);
    expect(secondArtwork).toBeUndefined();
  });

  it('does not retry (and fails the export) when copying fails without artwork', async () => {
    imageSearchRepository.findLatestImageForTrack.mockResolvedValue(null);
    copyAudioWithMetadata.copyAudioWithMetadata.mockRejectedValue(new Error('ffmpeg exited with code 1'));

    await expect(useCase.execute(playlistId)).rejects.toThrow('ffmpeg exited with code 1');
    expect(copyAudioWithMetadata.copyAudioWithMetadata).toHaveBeenCalledTimes(1);
  });

  it('fails the whole export when the source file is missing', async () => {
    existsSyncMock.mockReturnValue(false);

    const result = await useCase.execute(playlistId);

    expect(result).toBe(false);
    expect(copyAudioWithMetadata.copyAudioWithMetadata).not.toHaveBeenCalled();
  });

  describe('genre / style / comment tags', () => {
    it('uses subgenres for genre and style, genres for comment', async () => {
      playlistRepository.getOneByIdWithTracks.mockResolvedValue({
        name: 'My Playlist',
        tracks: [
          {
            track: buildTrack({ metadata: { genres: ['House', 'Techno'], subgenres: ['Deep House'] } }),
          },
        ],
      });

      await useCase.execute(playlistId);

      const [, , metadata] = copyAudioWithMetadata.copyAudioWithMetadata.mock.calls[0];
      expect(metadata.genre).toBe('#deep house');
      expect(metadata.style).toBe('#deep house');
      expect(metadata.comment).toBe('#house, #techno');
    });

    it('yields empty strings when metadata is undefined', async () => {
      playlistRepository.getOneByIdWithTracks.mockResolvedValue({
        name: 'My Playlist',
        tracks: [{ track: buildTrack({ metadata: undefined }) }],
      });

      await useCase.execute(playlistId);

      const [, , metadata] = copyAudioWithMetadata.copyAudioWithMetadata.mock.calls[0];
      expect(metadata.genre).toBe('');
      expect(metadata.style).toBe('');
      expect(metadata.comment).toBe('');
    });

    it('yields empty strings when genres/subgenres are empty arrays', async () => {
      playlistRepository.getOneByIdWithTracks.mockResolvedValue({
        name: 'My Playlist',
        tracks: [{ track: buildTrack({ metadata: { genres: [], subgenres: [] } }) }],
      });

      await useCase.execute(playlistId);

      const [, , metadata] = copyAudioWithMetadata.copyAudioWithMetadata.mock.calls[0];
      expect(metadata.genre).toBe('');
      expect(metadata.style).toBe('');
      expect(metadata.comment).toBe('');
    });
  });
});
