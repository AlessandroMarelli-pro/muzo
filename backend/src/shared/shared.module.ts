import { Module } from '@nestjs/common';
import { ElasticsearchService } from './services/elasticsearch.service';
import { PrismaService } from './services/prisma.service';

@Module({
  providers: [PrismaService, ElasticsearchService],
  exports: [PrismaService, ElasticsearchService],
})
export class SharedModule {}
