import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { isDomainError, type DomainError } from 'src/kernel/types/errors';

const DOMAIN_ERROR_CODES: Record<DomainError['errorType'], string> = {
  NotFoundError: 'NOT_FOUND',
  ConflictError: 'CONFLICT',
} as const;

function domainErrorToGraphQL(exception: DomainError): GraphQLError {
  const code = DOMAIN_ERROR_CODES[exception.errorType] ?? 'BAD_REQUEST';
  return new GraphQLError(exception.message, {
    extensions: { code }, // Avoid capturing a stack so it won’t be serialized
  });
}

/**
 * Catches domain errors (e.g. NotFoundError) and UnauthorizedException from guards
 * and maps them to GraphQL errors with extensions.code and message.
 * Sets HTTP 401 for UnauthorizedException so clients get the correct status.
 * Only runs in GraphQL context; other errors are rethrown.
 */
@Catch()
@Injectable()
export class DomainErrorExceptionFilter implements ExceptionFilter, GqlExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): GraphQLError | never {
    const gqlHost = GqlArgumentsHost.create(host);
    const type = gqlHost.getType<string>();

    if (type !== 'graphql') {
      throw exception;
    }

    if (exception instanceof UnauthorizedException) {
      const ctx = gqlHost.getContext<{ res?: { status: (code: number) => void } }>();
      if (ctx?.res) ctx.res.status(401);
      return new GraphQLError(exception.message, {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (isDomainError(exception)) {
      return domainErrorToGraphQL(exception as DomainError);
    }

    throw exception;
  }
}
