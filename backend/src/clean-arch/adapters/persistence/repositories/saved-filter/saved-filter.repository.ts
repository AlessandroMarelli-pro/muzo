import { Injectable } from '@nestjs/common';
import { ISavedFilterRepository } from 'src/clean-arch/application/ports/repositories/ISavedFilterRepository';
import { PrismaService } from 'src/clean-arch/infrastructure/database/prisma.service';
import { extractModelId, SavedFilterId } from 'src/clean-arch/kernel/ids';
import { getCurrentUserId } from 'src/clean-arch/kernel/types/context';
import { SavedFilter } from 'src/clean-arch/kernel/types/model-types';
import { handlePrismaNotFound } from '../prisma-errors';
import { toDomain, toPrisma, toPrismaUpdateData } from './saved-filter.mapper';

@Injectable()
export class SavedFilterRepository implements ISavedFilterRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(data: SavedFilter): Promise<SavedFilter> {
    return this.prisma.savedFilter
      .create({
        data: toPrisma(data),
      })
      .then(toDomain);
  }

  async getById(id: SavedFilterId): Promise<SavedFilter> {
    return this.prisma.savedFilter
      .findUnique({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .then(toDomain);
  }

  async updateById(id: SavedFilterId, data: SavedFilter): Promise<SavedFilter> {
    return this.prisma.savedFilter
      .update({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
        data: toPrismaUpdateData(data),
      })
      .then(toDomain)
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Saved filter with ID ${id} not found`),
      );
  }

  async getAll(): Promise<SavedFilter[]> {
    return this.prisma.savedFilter
      .findMany({
        where: { createdById: getCurrentUserId() },
      })
      .then((rows) => {
        if (rows.length === 0) return [];
        return rows.map(toDomain);
      });
  }

  async deleteById(id: SavedFilterId): Promise<boolean> {
    return this.prisma.savedFilter
      .delete({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .then(() => true)
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Saved filter with ID ${id} not found`),
      );
  }

  async getCurrentFilter(): Promise<SavedFilter> {
    return this.prisma.savedFilter
      .findFirst({
        where: { createdById: getCurrentUserId(), isCurrent: true },
      })
      .then((row) => (row ? toDomain(row) : null));
  }
}
