import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from 'src/infrastructure/database/database.module';
import { PRISMA_SERVICE } from 'src/infrastructure/database/prisma.service';
import { createBetterAuthInstance, type BetterAuthInstance } from './auth.provider';

/** Injection token for the Better Auth server instance (handler + api). */
export const BETTER_AUTH_INSTANCE = Symbol.for('BetterAuthInstance');

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [
    {
      provide: BETTER_AUTH_INSTANCE,
      useFactory: (
        prisma: Parameters<typeof createBetterAuthInstance>[0],
        config: ConfigService,
      ) => createBetterAuthInstance(prisma, config),
      inject: [PRISMA_SERVICE, ConfigService],
    },
  ],
  exports: [BETTER_AUTH_INSTANCE],
})
export class AuthModule {}

export type { BetterAuthInstance };
