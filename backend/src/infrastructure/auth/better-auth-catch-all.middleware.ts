import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { BETTER_AUTH_INSTANCE } from './auth.module';
import type { BetterAuthInstance } from './auth.provider';

const AUTH_BASE = '/api/auth';

/**
 * Ensures all /api/auth/* requests (including /api/auth/dash/config, etc.) are
 * handled by Better Auth. The @thallesp/nestjs-better-auth package only registers
 * the exact path /api/auth, so subpaths would 404 without this.
 */
@Injectable()
export class BetterAuthCatchAllMiddleware implements NestMiddleware {
  constructor(
    @Inject(BETTER_AUTH_INSTANCE) private readonly auth: BetterAuthInstance,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.path.startsWith(AUTH_BASE)) {
      next();
      return;
    }
    try {
      const handler = toNodeHandler(this.auth);
      await handler(req as any, res as any);
    } catch (err) {
      next(err);
    }
  }
}
