import { Test } from '@nestjs/testing';
import { ImageSearchRepository } from 'src/adapters/persistence/repositories/image-search/image-search.repository';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { MusicTrackId } from 'src/kernel/ids';
import { models } from 'src/kernel/types/models';
import { createMockPrisma } from '../_test-utils/prisma-mock';

const TEST_USER_ID = 'test-user-id';
const TRACK_DB_ID = 'track-uuid-1';

vi.mock('src/kernel/types/context', () => ({
  ...vi.importActual('src/kernel/types/context'),
  getCurrentUserId: vi.fn(() => TEST_USER_ID),
  now: vi.fn(() => new Date()),
  user: vi.fn(() => ({ id: 'User:test-user-id' })),
}));

describe('ImageSearchRepository', () => {
  let repo: ImageSearchRepository;
  let prismaMock: ReturnType<typeof createMockPrisma>;
  const trackId = models.musicTrack.id(TRACK_DB_ID) as MusicTrackId;

  beforeEach(async () => {
    prismaMock = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [ImageSearchRepository, { provide: PRISMA_SERVICE, useValue: prismaMock }],
    }).compile();
    repo = module.get(ImageSearchRepository);
  });

  describe('save', () => {
    it('persists the cover-art bytes and mime type', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      prismaMock.imageSearch.create.mockResolvedValue({
        id: 'is-1',
        trackId: TRACK_DB_ID,
        searchUrl: 'https://example.com/cover.jpg',
        status: 'COMPLETED',
        imagePath: '/ai/muzo/images/cover.jpg',
        imageUrl: 'https://example.com/cover.jpg',
        imageData: bytes,
        imageMimeType: 'image/jpeg',
        error: null,
        source: 'apple_music',
        createdAt: new Date(),
        createdById: TEST_USER_ID,
        updatedAt: null,
        updatedById: null,
      });

      await repo.save(trackId, {
        searchUrl: 'https://example.com/cover.jpg',
        imagePath: '/ai/muzo/images/cover.jpg',
        imageUrl: 'https://example.com/cover.jpg',
        source: 'apple_music',
        imageData: bytes,
        imageMimeType: 'image/jpeg',
      });

      expect(prismaMock.imageSearch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          trackId: TRACK_DB_ID,
          imageData: bytes,
          imageMimeType: 'image/jpeg',
          source: 'apple_music',
        }),
      });
    });
  });

  describe('findLatestImageForTrack', () => {
    it('returns the newest stored image as a Buffer + mime type', async () => {
      prismaMock.imageSearch.findFirst.mockResolvedValue({
        imageData: new Uint8Array([10, 20, 30]),
        imageMimeType: 'image/png',
      });

      const result = await repo.findLatestImageForTrack(trackId);

      expect(prismaMock.imageSearch.findFirst).toHaveBeenCalledWith({
        where: { trackId: TRACK_DB_ID, imageData: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { imageData: true, imageMimeType: true },
      });
      expect(result?.mimeType).toBe('image/png');
      expect(Buffer.isBuffer(result?.data)).toBe(true);
      expect(Array.from(result!.data)).toEqual([10, 20, 30]);
    });

    it('falls back to image/jpeg when mime type is missing', async () => {
      prismaMock.imageSearch.findFirst.mockResolvedValue({
        imageData: new Uint8Array([1]),
        imageMimeType: null,
      });

      const result = await repo.findLatestImageForTrack(trackId);

      expect(result?.mimeType).toBe('image/jpeg');
    });

    it('returns null when no stored image exists', async () => {
      prismaMock.imageSearch.findFirst.mockResolvedValue(null);

      const result = await repo.findLatestImageForTrack(trackId);

      expect(result).toBeNull();
    });
  });
});
