import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AnalysisStatus,
  PlaybackType,
  RepeatMode,
  ScanStatus,
  SessionStatus,
} from '@prisma/client';
import { PrismaService } from '../shared/services/prisma.service';

describe('Prisma Models', () => {
  let prismaService: PrismaService;

  beforeEach(async () => {
    const mockPrismaService = {
      musicLibrary: {
        create: jest.fn().mockResolvedValue({
          id: 'test-library-id',
          name: 'Test Library',
          rootPath: '/test/path',
          totalTracks: 0,
          analyzedTracks: 0,
          pendingTracks: 0,
          failedTracks: 0,
          scanStatus: ScanStatus.IDLE,
          autoScan: true,
          includeSubdirectories: true,
          supportedFormats: 'MP3,FLAC,WAV',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
      musicTrack: {
        create: jest.fn().mockResolvedValue({
          id: 'test-track-id',
          filePath: '/test/path/test.mp3',
          fileName: 'test.mp3',
          fileSize: 1024000,
          duration: 180.5,
          format: 'MP3',
          bitrate: 320,
          sampleRate: 44100,
          originalTitle: 'Test Song',
          originalArtist: 'Test Artist',
          originalAlbum: 'Test Album',
          originalGenre: 'Rock',
          originalYear: 2023,
          analysisStatus: AnalysisStatus.PENDING,
          libraryId: 'test-library-id',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
      audioFingerprint: {},
      aIAnalysisResult: {},
      intelligentEditorSession: {},
      playbackSession: {},
      userPreferences: {},
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  DATABASE_URL: 'file:./test.db',
                  DATABASE_LOGGING: false,
                };
                return config[key] !== undefined ? config[key] : defaultValue;
              }),
          },
        },
      ],
    }).compile();

    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be able to access Prisma models', () => {
    // Test that we can access the Prisma client models
    expect(prismaService.musicLibrary).toBeDefined();
    expect(prismaService.musicTrack).toBeDefined();
    expect(prismaService.audioFingerprint).toBeDefined();
    expect(prismaService.aIAnalysisResult).toBeDefined();
    expect(prismaService.intelligentEditorSession).toBeDefined();
    expect(prismaService.playbackSession).toBeDefined();
    expect(prismaService.userPreferences).toBeDefined();
  });

  it('should have correct enum values', () => {
    // Test enum values
    expect(ScanStatus.IDLE).toBe('IDLE');
    expect(ScanStatus.SCANNING).toBe('SCANNING');
    expect(ScanStatus.ANALYZING).toBe('ANALYZING');
    expect(ScanStatus.ERROR).toBe('ERROR');

    expect(AnalysisStatus.PENDING).toBe('PENDING');
    expect(AnalysisStatus.PROCESSING).toBe('PROCESSING');
    expect(AnalysisStatus.COMPLETED).toBe('COMPLETED');
    expect(AnalysisStatus.FAILED).toBe('FAILED');

    expect(SessionStatus.ACTIVE).toBe('ACTIVE');
    expect(SessionStatus.COMPLETED).toBe('COMPLETED');
    expect(SessionStatus.CANCELLED).toBe('CANCELLED');

    expect(PlaybackType.MANUAL).toBe('MANUAL');
    expect(PlaybackType.AUTO_PLAY).toBe('AUTO_PLAY');
    expect(PlaybackType.PLAYLIST).toBe('PLAYLIST');
    expect(PlaybackType.RADIO).toBe('RADIO');

    expect(RepeatMode.NONE).toBe('NONE');
    expect(RepeatMode.ONE).toBe('ONE');
    expect(RepeatMode.ALL).toBe('ALL');
  });

  it('should be able to create a music library', async () => {
    const musicLibrary = await prismaService.musicLibrary.create({
      data: {
        name: 'Test Library',
        rootPath: '/test/path',
        totalTracks: 0,
        analyzedTracks: 0,
        pendingTracks: 0,
        failedTracks: 0,
        scanStatus: ScanStatus.IDLE,
        autoScan: true,
        includeSubdirectories: true,
        supportedFormats: 'MP3,FLAC,WAV',
      },
    });

    expect(musicLibrary).toBeDefined();
    expect(musicLibrary.name).toBe('Test Library');
    expect(musicLibrary.rootPath).toBe('/test/path');
    expect(musicLibrary.scanStatus).toBe(ScanStatus.IDLE);
  });

  it('should be able to create a music track', async () => {
    // First create a library
    const library = await prismaService.musicLibrary.create({
      data: {
        name: 'Test Library',
        rootPath: '/test/path',
        totalTracks: 0,
        analyzedTracks: 0,
        pendingTracks: 0,
        failedTracks: 0,
        scanStatus: ScanStatus.IDLE,
        autoScan: true,
        includeSubdirectories: true,
        supportedFormats: 'MP3,FLAC,WAV',
      },
    });

    // Then create a track
    const track = await prismaService.musicTrack.create({
      data: {
        filePath: '/test/path/test.mp3',
        fileName: 'test.mp3',
        fileSize: 1024000,
        duration: 180.5,
        format: 'MP3',
        bitrate: 320,
        sampleRate: 44100,
        originalTitle: 'Test Song',
        originalArtist: 'Test Artist',
        originalAlbum: 'Test Album',
        originalGenre: 'Rock',
        originalYear: 2023,
        analysisStatus: AnalysisStatus.PENDING,
        libraryId: library.id,
      },
    });

    expect(track).toBeDefined();
    expect(track.fileName).toBe('test.mp3');
    expect(track.duration).toBe(180.5);
    expect(track.format).toBe('MP3');
    expect(track.analysisStatus).toBe(AnalysisStatus.PENDING);
  });
});
