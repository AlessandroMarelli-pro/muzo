import { IntegrationSettings as PrismaIntegrationSettings } from '@prisma/client';
import { extractModelId } from 'src/kernel/ids';
import { IntegrationSettings } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { toDbModel, toDbModelUpdate } from '../db';
import { toDomainModel } from '../domain';

const FIELDS = [
  'cosineApiKey',
  'spotifyClientId',
  'spotifyClientSecret',
  'tidalClientId',
  'tidalClientSecret',
  'youtubeClientId',
  'youtubeClientSecret',
] as const;

export const toDomain = (row: PrismaIntegrationSettings): IntegrationSettings => ({
  id: models.integrationSettings.id(row.id),
  ...toDomainModel({
    createdAt: row.createdAt,
    createdById: row.createdById,
    updatedAt: row.updatedAt ?? undefined,
    updatedById: row.updatedById ?? undefined,
  }),
  cosineApiKey: row.cosineApiKey,
  spotifyClientId: row.spotifyClientId,
  spotifyClientSecret: row.spotifyClientSecret,
  tidalClientId: row.tidalClientId,
  tidalClientSecret: row.tidalClientSecret,
  youtubeClientId: row.youtubeClientId,
  youtubeClientSecret: row.youtubeClientSecret,
});

export const toPrisma = (m: IntegrationSettings): PrismaIntegrationSettings => ({
  ...toDbModel(m),
  id: extractModelId(m.id).dbId,
  cosineApiKey: m.cosineApiKey ?? null,
  spotifyClientId: m.spotifyClientId ?? null,
  spotifyClientSecret: m.spotifyClientSecret ?? null,
  tidalClientId: m.tidalClientId ?? null,
  tidalClientSecret: m.tidalClientSecret ?? null,
  youtubeClientId: m.youtubeClientId ?? null,
  youtubeClientSecret: m.youtubeClientSecret ?? null,
});

export const toPrismaUpdate = (
  m: Partial<Omit<IntegrationSettings, 'id' | 'createdAt' | 'createdById'>>,
): Partial<PrismaIntegrationSettings> => {
  const out: Partial<PrismaIntegrationSettings> = { ...toDbModelUpdate(m) };
  for (const f of FIELDS) {
    if (m[f] !== undefined) out[f] = m[f] as string | null;
  }
  return out;
};
