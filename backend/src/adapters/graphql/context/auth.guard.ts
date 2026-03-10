import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { isAnonymousUser } from '../../../kernel/types/defaults';

/**
 * Certifies that the user is authenticated.
 * Expects req.user and ALS context to be set by ActionContextMiddleware.
 * Rejects with 401 when user is missing or anonymous.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const gqlContext = GqlExecutionContext.create(context).getContext();
    const user = gqlContext.req?.user;

    if (!user || isAnonymousUser(user)) {
      throw new UnauthorizedException('Authentication required');
    }

    return true;
  }
}
