import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';
import { CleanArchGraphQLModule } from './clean-arch/adapters/graphql/graphql.module';
import { RepositoriesModule } from './clean-arch/adapters/persistence/repositories/repositories.module';
import { UseCasesModule } from './clean-arch/application/use-cases/use-cases.module';
import { ConfigModuleSetup } from './config';
import { GraphiQLModule } from './graphiql/graphiql.module';
import { AdminMethodsModule } from './modules/admin-methods/admin-methods.module';
import { AiIntegrationModule } from './modules/ai-integration/ai-integration.module';
import { FilterModule } from './modules/filter/filter.module';
import { HealthModule } from './modules/health/health.module';
import { ImageModule } from './modules/image/image.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { MusicLibraryModule } from './modules/music-library/music-library.module';
import { MusicPlayerModule } from './modules/music-player/music-player.module';
import { MusicTrackModule } from './modules/music-track/music-track.module';
import { PlaybackQueueModule } from './modules/playback-queue/playback-queue.module';
import { PlaylistModule } from './modules/playlist/playlist.module';
import { QueueModule } from './modules/queue/queue.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { ThirdPartySyncModule } from './modules/third-party-sync/third-party-sync.module';
import { UserPreferencesModule } from './modules/user-preferences/user-preferences.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    // Configuration module
    ConfigModuleSetup,

    // GraphiQL IDE at GET /graphql (must be before GraphQL module so middleware runs first)
    GraphiQLModule,

    // GraphQL module
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: (configService: ConfigService) => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        sortSchema: true,
        playground: false,
        introspection: configService.get<boolean>('app.graphqlIntrospection'),
        subscriptions: {
          'graphql-ws': true,
          'subscriptions-transport-ws': true,
        },
        formatError: (formattedError) => {
          // Remove stacktrace from response (keep it in server logs if needed)
          if (formattedError.extensions?.stacktrace) {
            const { stacktrace, ...rest } = formattedError.extensions;
            return { ...formattedError, extensions: rest };
          }
          return formattedError;
        },
      }),
      inject: [ConfigService],
    }),

    // Clean architecture graphql module
    CleanArchGraphQLModule,

    // Shared module for common services
    SharedModule,

    // Clean architecture modules
    RepositoriesModule,
    UseCasesModule,

    // Queue module for background processing
    QueueModule,

    // Feature modules
    HealthModule,
    ImageModule,
    MusicLibraryModule,
    MusicTrackModule,
    MusicPlayerModule,
    PlaybackQueueModule,
    PlaylistModule,
    RecommendationModule,
    ThirdPartySyncModule,
    UserPreferencesModule,
    AiIntegrationModule,
    FilterModule,
    MetricsModule,
    AdminMethodsModule,
  ],
})
export class AppModule {}
