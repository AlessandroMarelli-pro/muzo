import { Module } from '@nestjs/common';
import {
  PRISMA_SERVICE,
  PrismaService,
} from 'src/infrastructure/database/prisma.service';
import { AdminMethodsController } from './admin-methods.controller';
import { AdminMethodsService } from './admin-methods.service';

@Module({
  imports: [],
  controllers: [AdminMethodsController],
  providers: [
    { provide: PRISMA_SERVICE, useClass: PrismaService },
    AdminMethodsService,
  ],
  exports: [AdminMethodsService],
})
export class AdminMethodsModule {}
