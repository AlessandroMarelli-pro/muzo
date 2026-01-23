import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ScanStatus } from '@prisma/client';
import {
  CreateMusicLibraryDto,
  MusicLibrary,
  MusicLibraryQueryOptions,
  MusicLibraryWithTracks,
  UpdateMusicLibraryDto
} from '../../models/music-library.model';
import { PrismaService } from '../../shared/services/prisma.service';

@Injectable()
export class MusicLibraryService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createDto: CreateMusicLibraryDto): Promise<MusicLibrary> {
    // Validate root path exists and is accessible
    if (!this.isValidPath(createDto.rootPath)) {
      throw new BadRequestException('Invalid root path provided');
    }

    // Check if library with same root path already exists
    const existingLibrary = await this.prisma.musicLibrary.findFirst({
      where: { rootPath: createDto.rootPath },
    });

    if (existingLibrary) {
      throw new BadRequestException(
        'Library with this root path already exists',
      );
    }

    return this.prisma.musicLibrary.create({
      data: {
        name: createDto.name,
        rootPath: createDto.rootPath,
        totalTracks: 0,
        analyzedTracks: 0,
        pendingTracks: 0,
        failedTracks: 0,
        scanStatus: ScanStatus.IDLE,
        autoScan: createDto.autoScan ?? true,
        scanInterval: createDto.scanInterval,
        includeSubdirectories: createDto.includeSubdirectories ?? true,
        supportedFormats:
          createDto.supportedFormats ?? 'MP3,FLAC,WAV,AAC,OGG,OPUS,M4A',
        maxFileSize: createDto.maxFileSize,
      },
    });
  }

  async findAll(
    options: MusicLibraryQueryOptions = {},
  ): Promise<MusicLibrary[]> {
    const {
      limit = 200,
      offset = 0,
      orderBy = 'createdAt',
      orderDirection = 'desc',
    } = options;

    return this.prisma.musicLibrary.findMany({
      take: limit,
      skip: offset,
      orderBy: { [orderBy]: orderDirection },
    });
  }

  async findOne(id: string): Promise<MusicLibraryWithTracks> {
    const library = await this.prisma.musicLibrary.findUnique({
      where: { id },
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

    if (!library) {
      throw new NotFoundException(`Music library with ID ${id} not found`);
    }

    return library;
  }

  async update(
    id: string,
    updateDto: UpdateMusicLibraryDto,
  ): Promise<MusicLibrary> {
    const existingLibrary = await this.prisma.musicLibrary.findUnique({
      where: { id },
    });

    if (!existingLibrary) {
      throw new NotFoundException(`Music library with ID ${id} not found`);
    }

    // Validate root path if being updated
    if (updateDto.rootPath && !this.isValidPath(updateDto.rootPath)) {
      throw new BadRequestException('Invalid root path provided');
    }

    // Check for duplicate root path if being updated
    if (updateDto.rootPath && updateDto.rootPath !== existingLibrary.rootPath) {
      const duplicateLibrary = await this.prisma.musicLibrary.findFirst({
        where: {
          rootPath: updateDto.rootPath,
          id: { not: id },
        },
      });

      if (duplicateLibrary) {
        throw new BadRequestException(
          'Library with this root path already exists',
        );
      }
    }

    return this.prisma.musicLibrary.update({
      where: { id },
      data: updateDto,
    });
  }

  async remove(id: string): Promise<void> {
    const existingLibrary = await this.prisma.musicLibrary.findUnique({
      where: { id },
    });

    if (!existingLibrary) {
      throw new NotFoundException(`Music library with ID ${id} not found`);
    }

    await this.prisma.musicLibrary.delete({
      where: { id },
    });
  }

  async updateScanStatus(
    id: string,
    status: ScanStatus,
  ): Promise<MusicLibrary> {
    const library = await this.prisma.musicLibrary.findUnique({
      where: { id },
    });

    if (!library) {
      throw new NotFoundException(`Music library with ID ${id} not found`);
    }

    return this.prisma.musicLibrary.update({
      where: { id },
      data: {
        scanStatus: status,
        ...(status === ScanStatus.SCANNING && { lastScanAt: new Date() }),
        ...(status === ScanStatus.IDLE && {
          lastIncrementalScanAt: new Date(),
        }),
      },
    });
  }



  private isValidPath(path: string): boolean {
    // Basic path validation - in a real implementation, you'd check if the path exists
    // and is accessible. For now, we'll do basic validation.
    return path && path.length > 0 && path.startsWith('/');
  }
}
