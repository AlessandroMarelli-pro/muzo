import { Injectable, NotFoundException } from '@nestjs/common';
import { ScanStatus } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';

@Injectable()
export class MusicLibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
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

  async updateScanStatus(id: string, status: ScanStatus) {
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
}
