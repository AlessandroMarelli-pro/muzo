import { Logger } from '@nestjs/common';
import { retryOnSqliteBusy } from 'src/adapters/persistence/repositories/retry-on-sqlite-busy';
import { describe, expect, it, vi } from 'vitest';

function makeLogger(): Logger {
  return { warn: vi.fn(), error: vi.fn() } as unknown as Logger;
}

function busyError() {
  return Object.assign(new Error('Operation has timed out'), { code: 'P1008' });
}

describe('retryOnSqliteBusy', () => {
  it('happy path: returns the result on first success without retrying', async () => {
    const operation = vi.fn().mockResolvedValue('ok');
    const logger = makeLogger();

    const result = await retryOnSqliteBusy(operation, logger, 'test');

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on SQLITE_BUSY (P1008) and succeeds once the lock clears', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(busyError())
      .mockRejectedValueOnce(busyError())
      .mockResolvedValueOnce('ok');
    const logger = makeLogger();

    const result = await retryOnSqliteBusy(operation, logger, 'test');

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('gives up after the max attempts and rethrows the last error', async () => {
    const error = busyError();
    const operation = vi.fn().mockRejectedValue(error);
    const logger = makeLogger();

    await expect(retryOnSqliteBusy(operation, logger, 'test')).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(5);
  });

  it('non-busy errors are not retried and propagate immediately', async () => {
    const error = new Error('some other DB error');
    const operation = vi.fn().mockRejectedValue(error);
    const logger = makeLogger();

    await expect(retryOnSqliteBusy(operation, logger, 'test')).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('recognizes "database is locked" message even without a P1008 code', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('SQLITE_BUSY: database is locked'))
      .mockResolvedValueOnce('ok');
    const logger = makeLogger();

    const result = await retryOnSqliteBusy(operation, logger, 'test');

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
