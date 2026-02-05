import { Injectable } from '@nestjs/common';
import {
  IMusicLibraryRepository,
  MusicLibraryUpdateData,
} from 'src/clean-arch/application/ports/repositories/IMusicLibraryRepository';
import { PrismaService } from 'src/clean-arch/infrastructure/database/prisma.service';
import { extractModelId, MusicLibraryId } from 'src/clean-arch/kernel/ids';
import { getCurrentUserId, MusicLibrary } from 'src/clean-arch/kernel/types';
import { handlePrismaNotFound } from '../prisma-errors';
import {
  toDomain,
  toDomainArray,
  toPrisma,
  toPrismaUpdate,
} from './music-library.mapper';

@Injectable()
export class MusicLibraryRepository implements IMusicLibraryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(library: MusicLibrary): Promise<MusicLibrary> {
    return this.prisma.musicLibrary
      .create({
        data: toPrisma(library),
      })
      .then(toDomain);
  }

  async getOneById(id: MusicLibraryId): Promise<MusicLibrary> {
    return this.prisma.musicLibrary
      .findUniqueOrThrow({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .then(toDomain)
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Music library with ID ${id} not found`),
      );
  }

  async getMany(): Promise<MusicLibrary[]> {
    return this.prisma.musicLibrary
      .findMany({
        where: { createdById: getCurrentUserId() },
      })
      .then(toDomainArray);
  }

  async updateOneById(
    id: MusicLibraryId,
    data: MusicLibraryUpdateData,
  ): Promise<MusicLibrary> {
    return this.prisma.musicLibrary
      .update({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
        data: toPrismaUpdate(data),
      })
      .then(toDomain);
  }

  async deleteOneById(id: MusicLibraryId): Promise<boolean> {
    return this.prisma.musicLibrary
      .delete({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .then(() => true);
  }
}
