import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  logging: boolean;
  generateEngine: boolean;
}

export default registerAs(
  'database',
  (): DatabaseConfig => ({
    url: process.env.DATABASE_URL || 'file:./muzo.db',
    logging: process.env.DATABASE_LOGGING === 'true',
    generateEngine: process.env.PRISMA_GENERATE_ENGINE === 'true',
  }),
);
