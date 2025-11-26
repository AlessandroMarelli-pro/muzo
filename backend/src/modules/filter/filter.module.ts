import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { FilterResolver } from './filter.resolver';
import { FilterService } from './filter.service';

@Module({
  providers: [FilterService, FilterResolver, PrismaService],
  exports: [FilterService],
})
export class FilterModule {}
