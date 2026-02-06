import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { BullModule } from '@nestjs/bullmq';
import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';
import { AdminMethodsModule } from './admin-methods/admin-methods.module';
import { ActionContextMiddleware } from './clean-arch/adapters/common/middlewares/action-context.middleware';
import { CleanArchGraphQLModule } from './clean-arch/adapters/graphql/graphql.module';
import { HttpModule } from './clean-arch/adapters/http/http.module';
import { JobSchedulersModule } from './clean-arch/adapters/job-schedulers/job-schedulers.module';
import { AdaptersPersistenceModule } from './clean-arch/adapters/persistence/persistence.module';
import { createPlaylistStatsLoader } from './clean-arch/adapters/persistence/queries/playlist/playlist-stats.loader';
import { createPlaylistContainsTrackLoader } from './clean-arch/adapters/persistence/repositories/playlist-track/playlist-contains-track.loader';
import { createPlaylistTracksWithTrackLoader } from './clean-arch/adapters/persistence/repositories/playlist-track/playlist-track-with-track.loader';
import { createPlaylistTracksLoader } from './clean-arch/adapters/persistence/repositories/playlist-track/playlist-track.loader';
import {
  IPlaylistStatsQuery,
  PLAYLIST_STATS_QUERY,
} from './clean-arch/application/ports/queries/IPlaylistStatsQuery';
import {
  IPlaylistTrackRepository,
  PLAYLIST_TRACK_REPOSITORY,
} from './clean-arch/application/ports/repositories/IPlaylistTrackRepository';
import { UseCasesModule } from './clean-arch/application/use-cases/use-cases.module';
import { AiModule } from './clean-arch/infrastructure/external-services/ai/ai.module';
import { ElasticsearchModule } from './clean-arch/infrastructure/external-services/elasticsearch/elasticsearch.module';
import { ConfigModuleSetup, QueueConfig } from './config';
import { GraphiQLModule } from './graphiql/graphiql.module';
import { AiIntegrationModule } from './modules/ai-integration/ai-integration.module';
import { MusicLibraryModule } from './modules/music-library/music-library.module';
import { QueueModule } from './modules/queue/queue.module';
import { ThirdPartySyncModule } from './modules/third-party-sync/third-party-sync.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    AiModule,
    // Configuration module
    ConfigModuleSetup,

    // GraphiQL IDE at GET /graphql (must be before GraphQL module so middleware runs first)
    GraphiQLModule,

    // Clean architecture modules
    AdaptersPersistenceModule,
    UseCasesModule,

    // GraphQL module
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [AdaptersPersistenceModule],
      useFactory: (
        configService: ConfigService,
        statsQuery: IPlaylistStatsQuery,
        playlistTrackRepository: IPlaylistTrackRepository,
      ) => ({
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
        context: ({ req, res }) => ({
          req,
          res,
          loaders: {
            playlistStats: createPlaylistStatsLoader(statsQuery),
            playlistTracks: createPlaylistTracksLoader(playlistTrackRepository),
            playlistContainsTrack: createPlaylistContainsTrackLoader(
              playlistTrackRepository,
            ),
            playlistTracksWithTrack: createPlaylistTracksWithTrackLoader(
              playlistTrackRepository,
            ),
          },
        }),
      }),
      inject: [ConfigService, PLAYLIST_STATS_QUERY, PLAYLIST_TRACK_REPOSITORY],
    }),

    // Clean architecture graphql module
    CleanArchGraphQLModule,

    // Shared module for common services
    SharedModule,

    // Queue module for background processing
    QueueModule,

    // Feature modules

    HttpModule,
    MusicLibraryModule,
    ThirdPartySyncModule,
    AiIntegrationModule,
    AdminMethodsModule,
    ElasticsearchModule,
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const queueConfig = configService.get<QueueConfig>('queue');
        return {
          connection: {
            host: queueConfig.redis.host,
            port: queueConfig.redis.port,
            password: queueConfig.redis.password,
            db: queueConfig.redis.db,
          },
        };
      },
      inject: [ConfigService],
    }),
    JobSchedulersModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ActionContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
