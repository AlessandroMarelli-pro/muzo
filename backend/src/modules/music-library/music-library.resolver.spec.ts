import { Test, TestingModule } from '@nestjs/testing';
import { ScanStatus } from '@prisma/client';
import { FileScanningService } from '../../shared/services/file-scanning.service';
import { AudioFile } from '../queue/processors/library-scan.processor';
import { MusicLibraryResolver } from './music-library.resolver';
import { MusicLibraryService } from './music-library.service';

describe('MusicLibraryResolver', () => {
  let resolver: MusicLibraryResolver;
  let musicLibraryService: MusicLibraryService;
  let fileScanningService: FileScanningService;

  const mockLibrary = {
    id: 'test-library-id',
    name: 'Test Library',
    rootPath: '/test/path',
    totalTracks: 0,
    analyzedTracks: 0,
    pendingTracks: 0,
    failedTracks: 0,
    lastScanAt: null,
    lastIncrementalScanAt: null,
    scanStatus: ScanStatus.IDLE,
    autoScan: true,
    scanInterval: null,
    includeSubdirectories: true,
    supportedFormats: 'MP3,FLAC,WAV',
    maxFileSize: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    tracks: [], // Add tracks property for MusicLibraryWithTracks
  };

  const mockScanResult: AudioFile[] = [
    {
      filePath: 'path',
      fileName: 'name',
      fileSize: 1000,
      lastModified: new Date(),
      libraryId: 'id',
    },
  ];

  beforeEach(async () => {
    const mockMusicLibraryService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      updateScanStatus: jest.fn(),
    };

    const mockFileScanningService = {
      scanLibrary: jest.fn(),
      incrementalScan: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MusicLibraryResolver,
        {
          provide: MusicLibraryService,
          useValue: mockMusicLibraryService,
        },
        {
          provide: FileScanningService,
          useValue: mockFileScanningService,
        },
      ],
    }).compile();

    resolver = module.get<MusicLibraryResolver>(MusicLibraryResolver);
    musicLibraryService = module.get<MusicLibraryService>(MusicLibraryService);
    fileScanningService = module.get<FileScanningService>(FileScanningService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('libraries', () => {
    it('should return all libraries', async () => {
      jest
        .spyOn(musicLibraryService, 'findAll')
        .mockResolvedValue([mockLibrary]);

      const result = await resolver.libraries();

      expect(result).toEqual([mockLibrary]);
      expect(musicLibraryService.findAll).toHaveBeenCalledWith({});
    });

    it('should apply query options', async () => {
      const options = {
        limit: 10,
        offset: 20,
        orderBy: 'name',
        orderDirection: 'asc',
      };

      jest.spyOn(musicLibraryService, 'findAll').mockResolvedValue([]);

      await resolver.libraries(options);

      expect(musicLibraryService.findAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 20,
        orderBy: 'name',
        orderDirection: 'asc',
      });
    });
  });

  describe('library', () => {
    it('should return a library by id', async () => {
      jest.spyOn(musicLibraryService, 'findOne').mockResolvedValue(mockLibrary);

      const result = await resolver.library('test-library-id');

      expect(result).toEqual(mockLibrary);
      expect(musicLibraryService.findOne).toHaveBeenCalledWith(
        'test-library-id',
      );
    });

    it('should return null for non-existent library', async () => {
      jest
        .spyOn(musicLibraryService, 'findOne')
        .mockRejectedValue(new Error('Not found'));

      const result = await resolver.library('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('createLibrary', () => {
    it('should create a new library', async () => {
      const input = {
        name: 'New Library',
        rootPath: '/new/path',
        autoScan: true,
        includeSubdirectories: true,
        supportedFormats: ['MP3', 'FLAC'],
        maxFileSize: 100,
      };

      jest.spyOn(musicLibraryService, 'create').mockResolvedValue(mockLibrary);

      const result = await resolver.createLibrary(input);

      expect(result).toEqual(mockLibrary);
      expect(musicLibraryService.create).toHaveBeenCalledWith({
        name: 'New Library',
        rootPath: '/new/path',
        autoScan: true,
        scanInterval: undefined,
        includeSubdirectories: true,
        supportedFormats: 'MP3,FLAC',
        maxFileSize: 100,
      });
    });
  });

  describe('updateLibrary', () => {
    it('should update a library', async () => {
      const input = {
        name: 'Updated Library',
        autoScan: false,
      };

      const updatedLibrary = { ...mockLibrary, name: 'Updated Library' };
      jest
        .spyOn(musicLibraryService, 'update')
        .mockResolvedValue(updatedLibrary);

      const result = await resolver.updateLibrary('test-library-id', input);

      expect(result).toEqual(updatedLibrary);
      expect(musicLibraryService.update).toHaveBeenCalledWith(
        'test-library-id',
        {
          name: 'Updated Library',
          rootPath: undefined,
          autoScan: false,
          scanInterval: undefined,
          includeSubdirectories: undefined,
          supportedFormats: undefined,
          maxFileSize: undefined,
        },
      );
    });
  });

  describe('deleteLibrary', () => {
    it('should delete a library', async () => {
      jest.spyOn(musicLibraryService, 'remove').mockResolvedValue(undefined);

      const result = await resolver.deleteLibrary('test-library-id');

      expect(result).toBe(true);
      expect(musicLibraryService.remove).toHaveBeenCalledWith(
        'test-library-id',
      );
    });
  });

  describe('startLibraryScan', () => {
    it('should start a full library scan', async () => {
      jest
        .spyOn(fileScanningService, 'scanLibrary')
        .mockResolvedValue(mockScanResult);

      const result = await resolver.startLibraryScan('test-library-id', false);

      expect(result).toEqual({
        libraryId: 'test-library-id',
        scanId: expect.stringMatching(/^scan-\d+$/),
        status: 'COMPLETED',
        totalFiles: 10,
        processedFiles: 10,
        newTracks: 5,
        updatedTracks: 2,
        errors: 0,
        estimatedCompletion: expect.any(Date),
      });
      expect(fileScanningService.scanLibrary).toHaveBeenCalledWith(
        'test-library-id',
        {
          recursive: true,
          includeHidden: false,
          maxDepth: 10,
          dryRun: false,
        },
      );
    });

    it('should start an incremental library scan', async () => {
      jest
        .spyOn(fileScanningService, 'incrementalScan')
        .mockResolvedValue(mockScanResult);

      const result = await resolver.startLibraryScan('test-library-id', true);

      expect(result).toEqual({
        libraryId: 'test-library-id',
        scanId: expect.stringMatching(/^scan-\d+$/),
        status: 'COMPLETED',
        totalFiles: 10,
        processedFiles: 10,
        newTracks: 5,
        updatedTracks: 2,
        errors: 0,
        estimatedCompletion: expect.any(Date),
      });
      expect(fileScanningService.incrementalScan).toHaveBeenCalledWith(
        'test-library-id',
        {
          recursive: true,
          includeHidden: false,
          maxDepth: 10,
          dryRun: false,
        },
      );
    });
  });

  describe('stopLibraryScan', () => {
    it('should stop a library scan', async () => {
      jest
        .spyOn(musicLibraryService, 'updateScanStatus')
        .mockResolvedValue(mockLibrary);

      const result = await resolver.stopLibraryScan('test-library-id');

      expect(result).toBe(true);
      expect(musicLibraryService.updateScanStatus).toHaveBeenCalledWith(
        'test-library-id',
        ScanStatus.IDLE,
      );
    });
  });

  describe('settings', () => {
    it('should return library settings', async () => {
      const result = await resolver.settings(mockLibrary);

      expect(result).toEqual({
        autoScan: true,
        scanInterval: null,
        includeSubdirectories: true,
        supportedFormats: ['MP3', 'FLAC', 'WAV'],
        maxFileSize: null,
      });
    });
  });
});
