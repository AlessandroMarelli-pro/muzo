import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import puppeteer from 'puppeteer';
import request from 'supertest';
import { PrismaService } from '../../shared/services/prisma.service';
import { ImageModule } from './image.module';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock puppeteer
jest.mock('puppeteer');
const mockedPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;

describe('ImageModule Integration', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  const mockPrismaService = {
    musicTrack: {
      findUnique: jest.fn(),
    },
    imageSearch: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ImageModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    // Set up default mock values
    mockConfigService.get.mockReturnValue('https://covers.musichoarders.xyz/');

    // Mock puppeteer browser and page
    const mockPage = {
      setViewport: jest.fn().mockResolvedValue(undefined),
      setUserAgent: jest.fn().mockResolvedValue(undefined),
      goto: jest.fn().mockResolvedValue(undefined),
      evaluate: jest
        .fn()
        .mockResolvedValue('https://example.com/album-cover.jpg'),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockedPuppeteer.launch.mockResolvedValue(mockBrowser as any);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    // Mock axios responses for covers website scraping
    mockedAxios.get.mockResolvedValue({
      data: `
        <html>
          <body>
            <img src="https://example.com/album-cover.jpg" alt="Album Cover" />
            <div style="background-image: url('https://example.com/cover.png')"></div>
          </body>
        </html>
      `,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
  });

  describe('Health Check', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/api/images/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.timestamp).toBeDefined();
        });
    });
  });

  describe('Image Search', () => {
    it('should return 400 for missing trackId', () => {
      return request(app.getHttpServer())
        .post('/api/images/search')
        .send({})
        .expect(400);
    });

    it('should return 404 for non-existent track', () => {
      mockPrismaService.musicTrack.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .post('/api/images/search')
        .send({ trackId: 'non-existent-track' })
        .expect(404);
    });

    it('should create search for valid track', () => {
      const mockTrack = {
        id: 'valid-track',
        originalArtist: 'Test Artist',
        originalAlbum: 'Test Album',
        aiArtist: null,
        aiAlbum: null,
        userArtist: null,
        userAlbum: null,
      };

      mockPrismaService.musicTrack.findUnique.mockResolvedValue(mockTrack);

      // Mock the image search creation
      mockPrismaService.imageSearch.create.mockResolvedValue({
        id: 'search-id',
        trackId: 'valid-track',
        searchUrl:
          'https://covers.musichoarders.xyz?artist=Test%20Artist&album=Test%20Album',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return request(app.getHttpServer())
        .post('/api/images/search')
        .send({ trackId: 'valid-track' })
        .expect(201)
        .expect((res) => {
          expect(res.body.trackId).toBe('valid-track');
          expect(res.body.status).toBe('pending');
          expect(res.body.searchUrl).toContain('covers.musichoarders.xyz');
        });
    });
  });

  describe('Batch Search', () => {
    it('should return 400 for empty trackIds', () => {
      return request(app.getHttpServer())
        .post('/api/images/search/batch')
        .send({ trackIds: [] })
        .expect(400);
    });

    it('should return 400 for missing trackIds', () => {
      return request(app.getHttpServer())
        .post('/api/images/search/batch')
        .send({})
        .expect(400);
    });

    it('should process batch search', () => {
      const mockTrack = {
        id: 'valid-track',
        originalArtist: 'Test Artist',
        originalAlbum: 'Test Album',
        aiArtist: null,
        aiAlbum: null,
        userArtist: null,
        userAlbum: null,
      };

      mockPrismaService.musicTrack.findUnique.mockResolvedValue(mockTrack);

      // Mock the image search creation
      mockPrismaService.imageSearch.create.mockResolvedValue({
        id: 'search-id',
        trackId: 'track1',
        searchUrl:
          'https://covers.musichoarders.xyz?artist=Test%20Artist&album=Test%20Album',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return request(app.getHttpServer())
        .post('/api/images/search/batch')
        .send({ trackIds: ['track1', 'track2'] })
        .expect(201)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBe(2);
        });
    });
  });

  describe('Image URL', () => {
    it('should return null for non-existent track', () => {
      return request(app.getHttpServer())
        .get('/api/images/track/non-existent-track/url')
        .expect(200)
        .expect((res) => {
          expect(res.body.url).toBeNull();
        });
    });
  });
});
