import { Inject } from '@nestjs/common';
import {
  IOAuthTokenRepository,
  OAuthTokenRecord,
  ThirdPartyProvider,
} from 'src/application/ports/repositories/IOAuthTokenRepository';
import {
  PRISMA_SERVICE,
  PrismaService,
} from 'src/infrastructure/database/prisma.service';

const PROVIDER_SCOPE: Record<ThirdPartyProvider, string> = {
  youtube: 'youtube',
  tidal: 'tidal',
  spotify: 'spotify',
};

export class OAuthTokenRepository implements IOAuthTokenRepository {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
  ) {}

  async getToken(
    userId: string,
    provider: ThirdPartyProvider,
  ): Promise<OAuthTokenRecord | null> {
    const row = await this.prisma.thirdPartyOAuthToken.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    });
    if (!row) return null;
    return this.toRecord(row);
  }

  async saveToken(record: OAuthTokenRecord): Promise<void> {
    await this.prisma.thirdPartyOAuthToken.upsert({
      where: {
        userId_provider: {
          userId: record.userId,
          provider: record.provider,
        },
      },
      create: {
        userId: record.userId,
        provider: record.provider,
        accessToken: record.accessToken,
        refreshToken: record.refreshToken ?? null,
        expiresAt: record.expiresAt ?? null,
        scope: PROVIDER_SCOPE[record.provider],
      },
      update: {
        accessToken: record.accessToken,
        refreshToken: record.refreshToken ?? null,
        expiresAt: record.expiresAt ?? null,
      },
    });
  }

  async updateToken(
    userId: string,
    provider: ThirdPartyProvider,
    data: {
      accessToken: string;
      refreshToken?: string | null;
      expiresAt?: Date | null;
    },
  ): Promise<void> {
    await this.prisma.thirdPartyOAuthToken.update({
      where: {
        userId_provider: { userId, provider },
      },
      data: {
        accessToken: data.accessToken,
        ...(data.refreshToken !== undefined && {
          refreshToken: data.refreshToken ?? null,
        }),
        ...(data.expiresAt !== undefined && {
          expiresAt: data.expiresAt ?? null,
        }),
      },
    });
  }

  private toRecord(row: {
    userId: string;
    provider: string;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
  }): OAuthTokenRecord {
    return {
      userId: row.userId,
      provider: row.provider as ThirdPartyProvider,
      accessToken: row.accessToken,
      refreshToken: row.refreshToken,
      expiresAt: row.expiresAt,
    };
  }
}
