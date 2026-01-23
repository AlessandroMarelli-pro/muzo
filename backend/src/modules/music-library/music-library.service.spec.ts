import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ScanStatus } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import { MusicLibraryService } from './music-library.service';

describe('MusicLibraryService', () => {
  let service: MusicLibraryService;
  let prismaService: PrismaService;

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
  };

  const mockTracks = [
    {
      id: 'track-1',
      fileName: 'song1.mp3',
      duration: 180.5,
      format: 'MP3',
      analysisStatus: 'COMPLETED',
    },
    {
      id: 'track-2',
      fileName: 'song2.flac',
      duration: 240.0,
      format: 'FLAC',
      analysisStatus: 'PENDING',
    },
  ];

  beforeEach(async () => {
    const mockPrismaService = {
      musicLibrary: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MusicLibraryService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MusicLibraryService>(MusicLibraryService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new music library', async () => {
      const createDto = {
        name: 'Test Library',
        rootPath: '/test/path',
        autoScan: true,
        includeSubdirectories: true,
        supportedFormats: 'MP3,FLAC,WAV',
      };

      jest
        .spyOn(prismaService.musicLibrary, 'findFirst')
        .mockResolvedValue(null);
      jest
        .spyOn(prismaService.musicLibrary, 'create')
        .mockResolvedValue(mockLibrary);

      const result = await service.create(createDto);

      expect(result).toEqual(mockLibrary);
      expect(prismaService.musicLibrary.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          rootPath: createDto.rootPath,
          totalTracks: 0,
          analyzedTracks: 0,
          pendingTracks: 0,
          failedTracks: 0,
          scanStatus: ScanStatus.IDLE,
          autoScan: createDto.autoScan,
          scanInterval: undefined,
          includeSubdirectories: createDto.includeSubdirectories,
          supportedFormats: createDto.supportedFormats,
          maxFileSize: undefined,
        },
      });
    });

    it('should throw BadRequestException for invalid root path', async () => {
      const createDto = {
        name: 'Test Library',
        rootPath: '', // Invalid path
      };

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for duplicate root path', async () => {
      const createDto = {
        name: 'Test Library',
        rootPath: '/test/path',
      };

      jest
        .spyOn(prismaService.musicLibrary, 'findFirst')
        .mockResolvedValue(mockLibrary);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all music libraries', async () => {
      const libraries = [mockLibrary];
      jest
        .spyOn(prismaService.musicLibrary, 'findMany')
        .mockResolvedValue(libraries);

      const result = await service.findAll();

      expect(result).toEqual(libraries);
      expect(prismaService.musicLibrary.findMany).toHaveBeenCalledWith({
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply query options', async () => {
      const options = {
        limit: 10,
        offset: 20,
        orderBy: 'name' as const,
        orderDirection: 'asc' as const,
      };

      jest.spyOn(prismaService.musicLibrary, 'findMany').mockResolvedValue([]);

      await service.findAll(options);

      expect(prismaService.musicLibrary.findMany).toHaveBeenCalledWith({
        take: 10,
        skip: 20,
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a music library with tracks', async () => {
      const libraryWithTracks = { ...mockLibrary, tracks: mockTracks };
      jest
        .spyOn(prismaService.musicLibrary, 'findUnique')
        .mockResolvedValue(libraryWithTracks);

      const result = await service.findOne('test-library-id');

      expect(result).toEqual(libraryWithTracks);
      expect(prismaService.musicLibrary.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-library-id' },
        include: {
          tracks: {
            select: {
              id: true,
              fileName: true,
              duration: true,
              format: true,
              analysisStatus: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException for non-existent library', async () => {
      jest
        .spyOn(prismaService.musicLibrary, 'findUnique')
        .mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a music library', async () => {
      const updateDto = { name: 'Updated Library' };
      const updatedLibrary = { ...mockLibrary, name: 'Updated Library' };

      jest
        .spyOn(prismaService.musicLibrary, 'findUnique')
        .mockResolvedValue(mockLibrary);
      jest
        .spyOn(prismaService.musicLibrary, 'update')
        .mockResolvedValue(updatedLibrary);

      const result = await service.update('test-library-id', updateDto);

      expect(result).toEqual(updatedLibrary);
      expect(prismaService.musicLibrary.update).toHaveBeenCalledWith({
        where: { id: 'test-library-id' },
        data: updateDto,
      });
    });

    it('should throw NotFoundException for non-existent library', async () => {
      jest
        .spyOn(prismaService.musicLibrary, 'findUnique')
        .mockResolvedValue(null);

      await expect(service.update('non-existent-id', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a music library', async () => {
      jest
        .spyOn(prismaService.musicLibrary, 'findUnique')
        .mockResolvedValue(mockLibrary);
      jest
        .spyOn(prismaService.musicLibrary, 'delete')
        .mockResolvedValue(mockLibrary);

      await service.remove('test-library-id');

      expect(prismaService.musicLibrary.delete).toHaveBeenCalledWith({
        where: { id: 'test-library-id' },
      });
    });

    it('should throw NotFoundException for non-existent library', async () => {
      jest
        .spyOn(prismaService.musicLibrary, 'findUnique')
        .mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });


  describe('updateScanStatus', () => {
    it('should update scan status', async () => {
      const updatedLibrary = {
        ...mockLibrary,
        scanStatus: ScanStatus.SCANNING,
      };

      jest
        .spyOn(prismaService.musicLibrary, 'findUnique')
        .mockResolvedValue(mockLibrary);
      jest
        .spyOn(prismaService.musicLibrary, 'update')
        .mockResolvedValue(updatedLibrary);

      const result = await service.updateScanStatus(
        'test-library-id',
        ScanStatus.SCANNING,
      );

      expect(result).toEqual(updatedLibrary);
      expect(prismaService.musicLibrary.update).toHaveBeenCalledWith({
        where: { id: 'test-library-id' },
        data: {
          scanStatus: ScanStatus.SCANNING,
          lastScanAt: expect.any(Date),
        },
      });
    });
  });
});
