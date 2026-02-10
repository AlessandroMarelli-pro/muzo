import type { Logger as PinoLogger } from 'pino';
import { ILogger } from 'src/clean-arch/application/ports/infrastructure/ILogger';
import { als } from 'src/clean-arch/kernel/types/context';

export class NestjsLoggerAdapter implements ILogger {
  constructor(
    private readonly pino: PinoLogger,
    readonly name: string,
  ) {}

  debug(message: string, data?: Record<string, unknown>): void {
    this.pino.debug(this.mergePayload(data), message);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.pino.info(this.mergePayload(data), message);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.pino.warn(this.mergePayload(data), message);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.pino.error(this.mergePayload(data), message);
  }

  private getCurrentUserForLog(): string {
    try {
      const u = als.getStore()?.user;
      return u?.email ?? 'anonymous';
    } catch {
      return 'anonymous';
    }
  }

  private mergePayload(
    data?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      className: this.name,
      user: this.getCurrentUserForLog(),
      ...data,
    };
  }
}
