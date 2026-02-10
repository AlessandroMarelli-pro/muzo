import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { als } from 'src/kernel/types/context';
import type { ActionContext } from 'src/kernel/types/model-types';
import { getAnonymousUser } from '../../../kernel/types/defaults';

declare global {
  namespace Express {
    interface Request {
      user?: ActionContext['user'];
    }
  }
}

@Injectable()
export class ActionContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const user = req.user ?? getAnonymousUser();
    const actionContext: ActionContext = {
      now: new Date(),
      user,
    };
    als.run(actionContext, () => next());
  }
}
