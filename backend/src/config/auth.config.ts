import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  baseURL: string;
  secret: string;
  google?: { clientId: string; clientSecret: string };
  github?: { clientId: string; clientSecret: string };
}

export default registerAs(
  'auth',
  (): AuthConfig => ({
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    secret: process.env.BETTER_AUTH_SECRET || '',
    google:
      process.env.BETTER_AUTH_GOOGLE_CLIENT_ID && process.env.BETTER_AUTH_GOOGLE_CLIENT_SECRET
        ? {
            clientId: process.env.BETTER_AUTH_GOOGLE_CLIENT_ID,
            clientSecret: process.env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
          }
        : undefined,
    github:
      process.env.BETTER_AUTH_GITHUB_CLIENT_ID && process.env.BETTER_AUTH_GITHUB_CLIENT_SECRET
        ? {
            clientId: process.env.BETTER_AUTH_GITHUB_CLIENT_ID,
            clientSecret: process.env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
          }
        : undefined,
  }),
);
