import { Module } from '@nestjs/common';
import { PrismaService } from '../clean-arch/infrastructure/database/prisma.service';
import { AdminMethodsController } from './admin-methods.controller';
import { AdminMethodsService } from './admin-methods.service';

@Module({
  imports: [],
  controllers: [AdminMethodsController],
  providers: [AdminMethodsService, PrismaService],
  exports: [AdminMethodsService],
})
export class AdminMethodsModule {}
