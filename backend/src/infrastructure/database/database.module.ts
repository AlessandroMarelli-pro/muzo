import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PRISMA_SERVICE, PrismaService } from './prisma.service';

/**
 * Infrastructure module that provides the database connection (Prisma).
 * Used by persistence adapters and other infrastructure (e.g. auth).
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [{ provide: PRISMA_SERVICE, useClass: PrismaService }],
  exports: [PRISMA_SERVICE],
})
export class DatabaseModule {}
