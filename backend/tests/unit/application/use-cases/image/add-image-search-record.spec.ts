import { AddImageSearchRecordUseCase } from 'src/application/use-cases/image/AddImageSearchRecord';
import type { IImageSearchRepository } from 'src/application/ports/repositories/IImageSearchRepository';
import type { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { MusicTrackId } from 'src/kernel/ids';
import { models } from 'src/kernel/types/models';

const noopLogger: ILogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as ILogger;

describe('AddImageSearchRecordUseCase', () => {
  const trackId = models.musicTrack.id('track-1') as MusicTrackId;
  let repo: { save: ReturnType<typeof vi.fn>; findLatestImageForTrack: ReturnType<typeof vi.fn> };
  let useCase: AddImageSearchRecordUseCase;

  beforeEach(() => {
    repo = { save: vi.fn().mockResolvedValue({}), findLatestImageForTrack: vi.fn() };
    useCase = new AddImageSearchRecordUseCase(
      repo as unknown as IImageSearchRepository,
      { createLogger: () => noopLogger },
      noopLogger,
    );
  });

  it('decodes imageBase64 into bytes and stores mime type', async () => {
    const original = Buffer.from('fake-image-bytes');
    await useCase.execute(trackId, {
      imagePath: '/ai/muzo/images/cover.jpg',
      imageUrl: 'https://example.com/cover.jpg',
      source: 'apple_music',
      imageBase64: original.toString('base64'),
      imageMimeType: 'image/jpeg',
    });

    expect(repo.save).toHaveBeenCalledTimes(1);
    const [, data] = repo.save.mock.calls[0];
    expect(Buffer.from(data.imageData).equals(original)).toBe(true);
    expect(data.imageMimeType).toBe('image/jpeg');
    expect(data.searchUrl).toBe('https://example.com/cover.jpg');
  });

  it('stores no bytes when imageBase64 is absent', async () => {
    await useCase.execute(trackId, {
      imagePath: '/ai/muzo/images/cover.jpg',
      source: 'embedded',
    });

    const [, data] = repo.save.mock.calls[0];
    expect(data.imageData).toBeUndefined();
    // falls back to imagePath as the opaque searchUrl reference
    expect(data.searchUrl).toBe('/ai/muzo/images/cover.jpg');
  });
});
