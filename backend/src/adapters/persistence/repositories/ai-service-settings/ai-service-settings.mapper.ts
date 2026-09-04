import { AiServiceSettings as PrismaAiServiceSettings } from '@prisma/client';
import { extractModelId } from 'src/kernel/ids';
import { AiServiceMode, AiServiceSettings } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { toDbModel, toDbModelUpdate } from '../db';
import { toDomainModel } from '../domain';

export type ToDomain = (row: PrismaAiServiceSettings) => AiServiceSettings;

export const toDomain: ToDomain = (row) => {
  return {
    id: models.aiServiceSettings.id(row.id),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt ?? undefined,
      updatedById: row.updatedById ?? undefined,
    }),
    mode: row.mode as AiServiceMode,
    remoteUrl: row.remoteUrl,
    authToken: row.authToken,
    replicas: row.replicas,
    geminiApiKey: row.geminiApiKey,
    hfToken: row.hfToken,
    lastfmApiKey: row.lastfmApiKey,
    lastfmSecret: row.lastfmSecret,
    discogsApiKeys: row.discogsApiKeys,
  };
};

export type ToPrisma = (domainModel: AiServiceSettings) => PrismaAiServiceSettings;

export const toPrisma: ToPrisma = (domainModel) => {
  return {
    ...toDbModel(domainModel),
    id: extractModelId(domainModel.id).dbId,
    mode: domainModel.mode,
    remoteUrl: domainModel.remoteUrl ?? null,
    authToken: domainModel.authToken ?? null,
    replicas: domainModel.replicas,
    geminiApiKey: domainModel.geminiApiKey ?? null,
    hfToken: domainModel.hfToken ?? null,
    lastfmApiKey: domainModel.lastfmApiKey ?? null,
    lastfmSecret: domainModel.lastfmSecret ?? null,
    discogsApiKeys: domainModel.discogsApiKeys ?? null,
  };
};

export type ToPrismaUpdate = (
  domainModel: Partial<Omit<AiServiceSettings, 'id' | 'createdAt' | 'createdById'>>,
) => Partial<PrismaAiServiceSettings>;

export const toPrismaUpdate: ToPrismaUpdate = (domainModel) => {
  return {
    ...toDbModelUpdate(domainModel),
    ...(domainModel.mode !== undefined && { mode: domainModel.mode }),
    ...(domainModel.remoteUrl !== undefined && { remoteUrl: domainModel.remoteUrl }),
    ...(domainModel.authToken !== undefined && { authToken: domainModel.authToken }),
    ...(domainModel.replicas !== undefined && { replicas: domainModel.replicas }),
    ...(domainModel.geminiApiKey !== undefined && { geminiApiKey: domainModel.geminiApiKey }),
    ...(domainModel.hfToken !== undefined && { hfToken: domainModel.hfToken }),
    ...(domainModel.lastfmApiKey !== undefined && { lastfmApiKey: domainModel.lastfmApiKey }),
    ...(domainModel.lastfmSecret !== undefined && { lastfmSecret: domainModel.lastfmSecret }),
    ...(domainModel.discogsApiKeys !== undefined && { discogsApiKeys: domainModel.discogsApiKeys }),
  };
};
