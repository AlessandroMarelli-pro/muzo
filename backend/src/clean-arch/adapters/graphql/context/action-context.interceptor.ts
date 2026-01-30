import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { als } from 'src/clean-arch/kernel/types/context';
import type { ActionContext } from 'src/clean-arch/kernel/types/model-types';
import { getAnonymousUser } from './default-user';

function getRequestUser(req: unknown): ActionContext['user'] | null {
  const r = req as { user?: ActionContext['user'] };
  return r?.user ?? null;
}

@Injectable()
export class ActionContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const gqlContext = GqlExecutionContext.create(context).getContext();
    const request = gqlContext.req ?? null;

    const user = getRequestUser(request) ?? getAnonymousUser();
    const actionContext: ActionContext = {
      now: new Date(),
      user,
    };
    return new Observable((subscriber) => {
      als.run(actionContext, () => {
        next.handle().subscribe({
          next: (value) => {
            subscriber.next(value);
            subscriber.complete();
          },
          error: (err) => subscriber.error(err),
        });
      });
    });
  }
}
