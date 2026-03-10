import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { NextFunction, Request, Response } from 'express';
import { als } from 'src/kernel/types/context';
import type { ActionContext } from 'src/kernel/types/model-types';
import { getAnonymousUser } from '../../../kernel/types/defaults';
import { BETTER_AUTH_INSTANCE } from '../../../infrastructure/auth/auth.module';
import type { BetterAuthInstance } from '../../../infrastructure/auth/auth.provider';
import {
  mapBetterAuthUserToContextUser,
  type BetterAuthSessionUser,
} from '../../../infrastructure/auth/session-user.mapper';

declare global {
  namespace Express {
    interface Request {
      user?: ActionContext['user'];
    }
  }
}

/**
 * Injects the current user into the request and into ALS (AsyncLocalStorage) for every request.
 * User comes from Better Auth session when present, otherwise anonymous.
 * Use AuthGuard on protected routes to reject unauthenticated (anonymous) users.
 */
@Injectable()
export class ActionContextMiddleware implements NestMiddleware {
  constructor(@Inject(BETTER_AUTH_INSTANCE) private readonly auth: BetterAuthInstance) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await (
        this.auth.api as {
          getSession: (ctx: { headers: Headers }) => Promise<{ user: BetterAuthSessionUser } | null>;
        }
      ).getSession({
        headers: fromNodeHeaders(req.headers),
      });
      const user = session?.user
        ? mapBetterAuthUserToContextUser(session.user)
        : getAnonymousUser();
      req.user = user;
      const actionContext: ActionContext = { now: new Date(), user };
      als.run(actionContext, () => next());
    } catch (err) {
      next(err);
    }
  }
}
