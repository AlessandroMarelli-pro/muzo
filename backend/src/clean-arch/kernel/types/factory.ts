import { createId } from '@paralleldrive/cuid2';

import { now, user } from './context';
import { ModelBase } from './domain-types';

export function modelFactory<M extends ModelBase<Id>, Id extends string>(id: {
  id: (id: string) => M['id'];
  isId: (id: string) => id is M['id'];
}) {
  return {
    is: (x: { id: string }): x is M => id.isId(x.id),
    isId: id.isId,
    id: id.id,
    instantiateNew: (x: NewInstanceParams<M>): M =>
      ({
        id: id.id(createId()),
        createdAt: now(),
        createdById: user().id,
        updatedAt: null,
        updatedById: null,
        ...x,
      }) as M,
  } as const;
}

export type NewInstanceParams<T> = Omit<T, keyof ModelBase>;

export function createNewInstance<T extends string>(id: T): ModelBase<T> {
  return {
    id,
    createdAt: now(),
    createdById: user().id,
    updatedAt: null,
    updatedById: null,
  };
}
