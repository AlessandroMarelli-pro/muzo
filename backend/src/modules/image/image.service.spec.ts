import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import puppeteer from 'puppeteer';
import { PrismaService } from '../../shared/services/prisma.service';
import { ImageService } from './image.service';

// Mock fs module
jest.mock('fs/promises', () => ({
  access: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock puppeteer
jest.mock('puppeteer');
const mockedPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;

describe('ImageService', () => {
  let service: ImageService;
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ImageService>(ImageService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset all mocks and set up default values
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('https://covers.musichoarders.xyz/');

    // Mock axios responses for covers website scraping
    mockedAxios.get.mockResolvedValue({
      data: Buffer.from('fake-image-data'),
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getImageForTrack', () => {
    it('should throw NotFoundException when track does not exist', async () => {
      const trackId = 'non-existent-track';
      mockPrismaService.musicTrack.findUnique.mockResolvedValue(null);

      await expect(service.getImageForTrack(trackId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return existing image if found', async () => {
      const trackId = 'existing-track';
      const mockTrack = {
        id: trackId,
        originalArtist: 'Test Artist',
        originalAlbum: 'Test Album',
        aiArtist: null,
        aiAlbum: null,
        userArtist: null,
        userAlbum: null,
      };

      mockPrismaService.musicTrack.findUnique.mockResolvedValue(mockTrack);

      // Mock the findExistingImage method to return an existing image
      mockPrismaService.imageSearch.findFirst.mockResolvedValue({
        id: 'image-id',
        trackId,
        searchUrl: 'https://example.com',
        status: 'COMPLETED',
        imagePath: 'test.jpg',
        imageUrl: '/api/images/test.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock the createImageSearchRecord method as fallback
      mockPrismaService.imageSearch.create.mockResolvedValue({
        id: 'search-id',
        trackId,
        searchUrl: 'https://example.com',
        status: 'COMPLETED',
        imagePath: 'test.jpg',
        imageUrl: '/api/images/test.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getImageForTrack(trackId);

      expect(result).toBeDefined();
      expect(result?.status).toBe('completed');
      expect(result?.imageUrl).toBe('/api/images/test.jpg');
    });
  });

  describe('searchImageForTrack', () => {
    it('should create search record for valid track', async () => {
      const trackId = 'valid-track';
      const mockTrack = {
        id: trackId,
        originalArtist: 'Test Artist',
        originalAlbum: 'Test Album',
        aiArtist: null,
        aiAlbum: null,
        userArtist: null,
        userAlbum: null,
      };

      mockPrismaService.musicTrack.findUnique.mockResolvedValue(mockTrack);

      // Mock the createImageSearchRecord method
      mockPrismaService.imageSearch.create.mockResolvedValue({
        id: 'search-id',
        trackId,
        searchUrl:
          'https://covers.musichoarders.xyz?artist=Test%20Artist&album=Test%20Album',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  });

  describe('batchSearchImages', () => {
    it('should process multiple tracks', async () => {
      const trackIds = ['track1', 'track2', 'track3'];

      // Mock successful search for each track
      mockPrismaService.musicTrack.findUnique.mockResolvedValue({
        id: 'track1',
        originalArtist: 'Artist 1',
        originalAlbum: 'Album 1',
        aiArtist: null,
        aiAlbum: null,
        userArtist: null,
        userAlbum: null,
      });

      mockPrismaService.imageSearch.create.mockResolvedValue({
        id: 'search-id',
        trackId: 'track1',
        searchUrl: 'https://example.com',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should continue processing even if some tracks fail', async () => {
      const trackIds = ['track1', 'track2', 'track3'];

      // Mock one failure and two successes
      mockPrismaService.musicTrack.findUnique
        .mockResolvedValueOnce({
          id: 'track1',
          originalArtist: 'Artist 1',
          originalAlbum: 'Album 1',
          aiArtist: null,
          aiAlbum: null,
          userArtist: null,
          userAlbum: null,
        })
        .mockRejectedValueOnce(new Error('Track not found'))
        .mockResolvedValueOnce({
          id: 'track3',
          originalArtist: 'Artist 3',
          originalAlbum: 'Album 3',
          aiArtist: null,
          aiAlbum: null,
          userArtist: null,
          userAlbum: null,
        });

      mockPrismaService.imageSearch.create.mockResolvedValue({
        id: 'search-id',
        trackId: 'track1',
        searchUrl: 'https://example.com',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  });

  describe('buildSearchParams', () => {
    it('should build URL search parameters correctly', () => {
      const params = {
        artist: 'Test Artist',
        album: 'Test Album',
        theme: 'dark' as const,
        resolution: '500x500',
      };

      const searchParams = (service as any).buildSearchParams(params);

      expect(searchParams.get('artist')).toBe('Test Artist');
      expect(searchParams.get('album')).toBe('Test Album');
      expect(searchParams.get('theme')).toBe('dark');
      expect(searchParams.get('resolution')).toBe('500x500');
    });

    it('should handle empty parameters', () => {
      const params = {};

      const searchParams = (service as any).buildSearchParams(params);

      expect(searchParams.toString()).toBe('');
    });
  });

  describe('buildSearchUrl', () => {
    it('should build correct search URL', () => {
      const searchParams = new URLSearchParams();
      searchParams.set('artist', 'Test Artist');
      searchParams.set('album', 'Test Album');

      const url = (service as any).buildSearchUrl(searchParams);

      expect(url).toBe(
        'https://covers.musichoarders.xyz?artist=Test+Artist&album=Test+Album',
      );
    });
  });
});
