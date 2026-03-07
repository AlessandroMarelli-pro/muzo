import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { getAnonymousUser } from '../../../kernel/types/defaults';

@Injectable()
export class HttpAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    if (request) {
      (request as { user?: unknown }).user = getAnonymousUser();
    }
    return true;
  }
}
