import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import { ModelBase } from 'src/clean-arch/kernel/types';

export function toDbModel(domainModel: ModelBase) {
  return {
    createdAt: domainModel.createdAt,
    createdById: extractModelId(domainModel.createdById).dbId,
    updatedAt: domainModel.updatedAt,
    updatedById: domainModel.updatedById
      ? extractModelId(domainModel.updatedById).dbId
      : null,
  };
}

export function toDbModelUpdate(domainModel: Partial<ModelBase>) {
  return {
    updatedAt: domainModel.updatedAt,
    updatedById: domainModel.updatedById
      ? extractModelId(domainModel.updatedById).dbId
      : null,
  };
}
