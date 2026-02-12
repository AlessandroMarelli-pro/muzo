import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

/**
 * Creates a deep mock of PrismaClient for unit testing persistence adapters.
 * Use with Nest TestingModule: { provide: PrismaService, useValue: createMockPrisma() }
 */
export function createMockPrisma(): DeepMockProxy<PrismaClient> {
  return mockDeep<PrismaClient>();
}
