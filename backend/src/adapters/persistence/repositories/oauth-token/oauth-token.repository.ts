import { Inject } from '@nestjs/common';
import {
  IOAuthTokenRepository,
  OAuthTokenRecord,
  ThirdPartyProvider,
} from 'src/application/ports/repositories/IOAuthTokenRepository';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';

const PROVIDER_SCOPE: Record<ThirdPartyProvider, string> = {
  youtube: 'youtube',
  tidal: 'tidal',
  spotify: 'spotify',
};

export class OAuthTokenRepository implements IOAuthTokenRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async getToken(userId: string, provider: ThirdPartyProvider): Promise<OAuthTokenRecord | null> {
    const row = await this.prisma.thirdPartyOAuthToken.findUnique({
      where: {
        createdById_provider: { createdById: userId, provider },
      },
    });
    if (!row) return null;
    return this.toRecord({ ...row, userId: row.createdById });
  }

  async saveToken(record: OAuthTokenRecord): Promise<void> {
    await this.prisma.thirdPartyOAuthToken.upsert({
      where: {
        createdById_provider: {
          createdById: record.userId,
          provider: record.provider,
        },
      },
      create: {
        createdById: record.userId,
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
        createdById_provider: { createdById: userId, provider },
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

  async listConnectedProviders(userId: string): Promise<ThirdPartyProvider[]> {
    const rows = await this.prisma.thirdPartyOAuthToken.findMany({
      where: { createdById: userId },
      select: { provider: true },
    });
    return rows.map((row) => row.provider as ThirdPartyProvider);
  }

  async deleteToken(userId: string, provider: ThirdPartyProvider): Promise<void> {
    try {
      await this.prisma.thirdPartyOAuthToken.delete({
        where: {
          createdById_provider: { createdById: userId, provider },
        },
      });
    } catch (error: unknown) {
      // P2025: record to delete does not exist — treat disconnect as idempotent.
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2025'
      ) {
        return;
      }
      throw error;
    }
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
