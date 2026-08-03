import { Logger } from '@nestjs/common';

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 100;

/**
 * SQLite serializes writers across OS processes even in WAL mode -- when multiple backend
 * instances run concurrently against the same DB file (by design, for throughput), a write
 * can transiently fail with SQLITE_BUSY / "database is locked" simply because another
 * process's writer got there first. Retrying with backoff rides this out instead of failing
 * the caller outright.
 */
function isSqliteBusyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ((error as { code?: string }).code === 'P1008') return true;
  const message = String((error as { message?: unknown }).message ?? error);
  return message.includes('SQLITE_BUSY') || message.includes('database is locked');
}

export async function retryOnSqliteBusy<T>(
  operation: () => Promise<T>,
  logger: Logger,
  label: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isSqliteBusyError(error) || attempt === MAX_ATTEMPTS) {
        throw error;
      }
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1) * (0.5 + Math.random());
      logger.warn(
        `${label}: database locked, retrying (attempt ${attempt}/${MAX_ATTEMPTS}) after ${Math.round(delay)}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
