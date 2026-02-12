import { Injectable, Inject } from '@nestjs/common';
import { ISavedFilterRepository } from 'src/application/ports/repositories/ISavedFilterRepository';
import {
  PRISMA_SERVICE,
  PrismaService,
} from 'src/infrastructure/database/prisma.service';
import { Maybe } from 'src/kernel/common';
import { extractModelId, SavedFilterId } from 'src/kernel/ids';
import { getCurrentUserId } from 'src/kernel/types/context';
import { SavedFilter } from 'src/kernel/types/model-types';
import { handlePrismaNotFound } from '../prisma-errors';
import { toDomain, toPrisma, toPrismaUpdateData } from './saved-filter.mapper';

@Injectable()
export class SavedFilterRepository implements ISavedFilterRepository {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
  ) {}

  async save(data: SavedFilter): Promise<SavedFilter> {
    return this.prisma.savedFilter
      .create({
        data: toPrisma(data),
      })
      .then(toDomain);
  }

  async getById(id: SavedFilterId): Promise<Maybe<SavedFilter>> {
    return this.prisma.savedFilter
      .findUnique({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .then((row) => (row ? toDomain(row) : null));
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

  async getCurrentFilter(): Promise<Maybe<SavedFilter>> {
    return this.prisma.savedFilter
      .findFirst({
        where: { createdById: getCurrentUserId(), isCurrent: true },
      })
      .then((row) => (row ? toDomain(row) : null));
  }
}
