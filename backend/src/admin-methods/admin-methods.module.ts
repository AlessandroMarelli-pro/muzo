import { Module } from '@nestjs/common';
import { AdminMethodsController } from './admin-methods.controller';
import { AdminMethodsService } from './admin-methods.service';

@Module({
  imports: [],
  controllers: [AdminMethodsController],
  providers: [AdminMethodsService],
  exports: [AdminMethodsService],
})
export class AdminMethodsModule {}
