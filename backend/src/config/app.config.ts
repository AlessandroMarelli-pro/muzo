import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  graphqlPlayground: boolean;
  graphqlIntrospection: boolean;
}

export default registerAs(
  'app',
  (): AppConfig => ({
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    graphqlPlayground: process.env.GRAPHQL_PLAYGROUND === 'true',
    graphqlIntrospection: process.env.GRAPHQL_INTROSPECTION === 'true',
  }),
);
