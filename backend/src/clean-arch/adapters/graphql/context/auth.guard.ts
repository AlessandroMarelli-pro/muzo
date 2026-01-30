// backend/src/clean-arch/adaptaters/graphql/context/auth.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { getAnonymousUser } from './default-user';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const gqlContext = GqlExecutionContext.create(context).getContext();
    const request = gqlContext.req;

    if (request) {
      (request as { user?: unknown }).user = getAnonymousUser();
    }

    return true;
  }
}
