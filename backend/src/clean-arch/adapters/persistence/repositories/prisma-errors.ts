import { createNotFoundError } from 'src/clean-arch/kernel/types';

const PRISMA_NOT_FOUND_CODE = 'P2025';

export function handlePrismaNotFound(error: unknown, message: string): never {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? (error as { code: string }).code
      : undefined;
  if (code === PRISMA_NOT_FOUND_CODE) {
    throw createNotFoundError(message);
  }
  throw error;
}
