import { Inject } from '@nestjs/common';
import {
  IIntegrationSettingsRepository,
  IntegrationSettingsUpdate,
} from 'src/application/ports/repositories/IIntegrationSettingsRepository';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { IntegrationSettings } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { toDomain, toPrisma, toPrismaUpdate } from './integration-settings.mapper';

/** Fixed id: this table only ever holds one row. */
const SINGLETON_ID = 'singleton';

/**
 * No real "current user" for this row -- read at request time (adapters resolve creds per call),
 * but built by hand with a fixed system id rather than instantiateNew() for consistency with
 * AiServiceSettingsRepository. See that file's note.
 */
const SYSTEM_USER_ID = models.user.id('userId');

const FIELDS = [
  'cosineApiKey',
  'spotifyClientId',
  'spotifyClientSecret',
  'tidalClientId',
  'tidalClientSecret',
  'youtubeClientId',
  'youtubeClientSecret',
] as const;

export class IntegrationSettingsRepository implements IIntegrationSettingsRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async get(): Promise<IntegrationSettings> {
    const row = await this.prisma.integrationSettings.upsert({
      where: { id: SINGLETON_ID },
      create: toPrisma(this.newDefaults()),
      update: {},
    });
    return toDomain(row);
  }

  async save(update: IntegrationSettingsUpdate): Promise<IntegrationSettings> {
    const provided: Record<string, string | null> = {};
    for (const f of FIELDS) {
      if (update[f] !== undefined) provided[f] = update[f] || null;
    }

    const row = await this.prisma.integrationSettings.upsert({
      where: { id: SINGLETON_ID },
      create: toPrisma({ ...this.newDefaults(), ...provided }),
      update: toPrismaUpdate({ updatedById: SYSTEM_USER_ID, ...provided }),
    });
    return toDomain(row);
  }

  private newDefaults(): IntegrationSettings {
    return {
      id: models.integrationSettings.id(SINGLETON_ID),
      createdAt: new Date(),
      createdById: SYSTEM_USER_ID,
      updatedAt: new Date(),
      updatedById: undefined,
      cosineApiKey: null,
      spotifyClientId: null,
      spotifyClientSecret: null,
      tidalClientId: null,
      tidalClientSecret: null,
      youtubeClientId: null,
      youtubeClientSecret: null,
    };
  }
}
