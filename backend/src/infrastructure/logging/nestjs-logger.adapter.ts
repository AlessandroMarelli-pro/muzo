import { Logger } from '@nestjs/common';
import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { als } from 'src/kernel/types/context';

export class NestjsLoggerAdapter implements ILogger {
  private readonly logger: Logger;

  constructor(readonly name: string) {
    this.logger = new Logger(this.name);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(message, this.formatPayload(data));
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.log(message, this.formatPayload(data));
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(message, this.formatPayload(data));
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.logger.error(message, this.formatPayload(data));
  }

  private getCurrentUserForLog(): string {
    try {
      const u = als.getStore()?.user;
      return u?.email ?? 'anonymous';
    } catch {
      return 'anonymous';
    }
  }

  private formatPayload(data?: Record<string, unknown>): string {
    const payload = {
      className: this.name,
      user: this.getCurrentUserForLog(),
      ...data,
    };
    return JSON.stringify(payload);
  }
}
