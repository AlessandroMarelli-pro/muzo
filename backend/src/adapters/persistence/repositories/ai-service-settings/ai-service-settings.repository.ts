import { Inject } from '@nestjs/common';
import {
  AiServiceSettingsUpdate,
  IAiServiceSettingsRepository,
} from 'src/application/ports/repositories/IAiServiceSettingsRepository';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { AiServiceSettings } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { toDomain, toPrisma, toPrismaUpdate } from './ai-service-settings.mapper';

/** Fixed id: this table only ever holds one row. */
const SINGLETON_ID = 'singleton';

/**
 * There is no real "current user" for this row -- unlike ThirdPartyOAuthToken (only ever read
 * inside an authenticated request), AiServerPoolAdapter reads this at app boot via
 * onModuleInit(), before any request's AsyncLocalStorage context exists. models.*.instantiateNew()
 * calls user()/now() from that context and would throw ("missing action context") on that boot
 * path, so a fresh row is built by hand below with this fixed system id instead -- the same value
 * the column defaults to -- rather than through instantiateNew().
 */
const SYSTEM_USER_ID = models.user.id('userId');

export class AiServiceSettingsRepository implements IAiServiceSettingsRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async get(): Promise<AiServiceSettings> {
    const row = await this.prisma.aiServiceSettings.upsert({
      where: { id: SINGLETON_ID },
      create: toPrisma(this.newDefaults()),
      update: {},
    });
    return toDomain(row);
  }

  async save(update: AiServiceSettingsUpdate): Promise<AiServiceSettings> {
    const defaults = this.newDefaults();
    const row = await this.prisma.aiServiceSettings.upsert({
      where: { id: SINGLETON_ID },
      create: toPrisma({
        ...defaults,
        ...(update.mode !== undefined && { mode: update.mode }),
        ...(update.remoteUrl !== undefined && { remoteUrl: update.remoteUrl }),
        // authToken undefined on create (no prior row) means "no token yet", not "unchanged".
        ...(update.authToken !== undefined && { authToken: update.authToken || null }),
        ...(update.replicas !== undefined && { replicas: update.replicas }),
        ...(update.geminiApiKey !== undefined && { geminiApiKey: update.geminiApiKey || null }),
        ...(update.hfToken !== undefined && { hfToken: update.hfToken || null }),
        ...(update.lastfmApiKey !== undefined && { lastfmApiKey: update.lastfmApiKey || null }),
        ...(update.lastfmSecret !== undefined && { lastfmSecret: update.lastfmSecret || null }),
        ...(update.discogsApiKeys !== undefined && { discogsApiKeys: update.discogsApiKeys || null }),
      }),
      update: toPrismaUpdate({
        updatedById: SYSTEM_USER_ID,
        ...(update.mode !== undefined && { mode: update.mode }),
        ...(update.remoteUrl !== undefined && { remoteUrl: update.remoteUrl }),
        // omitted (undefined) -> leave stored token untouched; null/"" -> clear it.
        ...(update.authToken !== undefined && { authToken: update.authToken || null }),
        ...(update.replicas !== undefined && { replicas: update.replicas }),
        ...(update.geminiApiKey !== undefined && { geminiApiKey: update.geminiApiKey || null }),
        ...(update.hfToken !== undefined && { hfToken: update.hfToken || null }),
        ...(update.lastfmApiKey !== undefined && { lastfmApiKey: update.lastfmApiKey || null }),
        ...(update.lastfmSecret !== undefined && { lastfmSecret: update.lastfmSecret || null }),
        ...(update.discogsApiKeys !== undefined && { discogsApiKeys: update.discogsApiKeys || null }),
      }),
    });
    return toDomain(row);
  }

  /** A fresh row's defaults, matching the Prisma column defaults in schema.prisma. */
  private newDefaults(): AiServiceSettings {
    return {
      id: models.aiServiceSettings.id(SINGLETON_ID),
      createdAt: new Date(),
      createdById: SYSTEM_USER_ID,
      updatedAt: new Date(),
      updatedById: undefined,
      mode: 'remote',
      remoteUrl: null,
      authToken: null,
      replicas: 1,
      geminiApiKey: null,
      hfToken: null,
      lastfmApiKey: null,
      lastfmSecret: null,
      discogsApiKeys: null,
    };
  }
}
