import { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '@prisma/client';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

/** Type for the Better Auth server instance (handler + api). */
export type BetterAuthInstance = { handler: (req: Request) => Promise<Response>; api: unknown };

/**
 * Creates the Better Auth instance (infrastructure layer).
 * Standard setup per https://better-auth.com/docs/installation — no infra (dash/sentinel).
 */
export function createBetterAuthInstance(
  prisma: PrismaClient,
  config: ConfigService,
): BetterAuthInstance {
  const baseURL = config.get<string>('auth.baseURL') ?? 'http://localhost:3000';
  const secret = config.get<string>('auth.secret');
  const google = config.get<{ clientId: string; clientSecret: string }>('auth.google');
  const github = config.get<{ clientId: string; clientSecret: string }>('auth.github');
  const corsOrigin = config.get<string>('app.corsOrigin');

  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
  if (google) socialProviders.google = google;
  if (github) socialProviders.github = github;

  const trustedOrigins = corsOrigin ? [corsOrigin, baseURL] : [baseURL];

  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'sqlite' }),
    baseURL: baseURL || 'http://localhost:3000',
    secret: secret || undefined,
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
  }) as BetterAuthInstance;
}
