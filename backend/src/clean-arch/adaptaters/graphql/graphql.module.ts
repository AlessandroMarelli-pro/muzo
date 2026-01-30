import { Module } from '@nestjs/common';
import { UseCasesModule } from 'src/clean-arch/application/use-cases/use-cases.module';
import { ActionContextInterceptor } from './context/action-context.interceptor';
import { AuthGuard } from './context/auth.guard';
import { CleanArchPlaylistResolver } from './resolvers/playlist.resolver';
import { Base64ID } from './scalars/base64-id.scalar';

@Module({
  imports: [UseCasesModule],
  providers: [
    CleanArchPlaylistResolver,
    ActionContextInterceptor,
    Base64ID,
    AuthGuard,
  ],
})
export class CleanArchGraphQLModule {}
