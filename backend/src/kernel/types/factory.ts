import { v4 as uuidv4 } from 'uuid';
import { UserId } from '../ids';
import { now, user } from './context';
import { ModelBase } from './model-types';

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
        id: id.id(uuidv4()),
        createdAt: now(),
        createdById: user().id,
        updatedAt: now(),
        updatedById: null,
        ...x,
      }) as M,
    update: (
      x: Partial<M>,
    ): Partial<M> & { updatedAt: Date; updatedById: UserId } => ({
      ...x,
      updatedAt: now(),
      updatedById: user().id,
    }),
  } as const;
}

export type NewInstanceParams<T> = Omit<T, keyof ModelBase>;

export function createNewInstance<T extends string>(id: T): ModelBase<T> {
  return {
    id,
    createdAt: now(),
    createdById: user().id,
    updatedAt: now(),
    updatedById: null,
  };
}
