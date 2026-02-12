import { AsyncLocalStorage } from 'node:async_hooks';
import { fail } from '../common';

import { extractModelId } from '../ids';
import { ActionContext } from './model-types';

export const als = new AsyncLocalStorage<ActionContext>();

export const now = () => als.getStore()?.now ?? fail('missing action context');

export const user = () =>
  als.getStore()?.user ?? fail('missing action context');

export const getCurrentUser = () => user();
export const getCurrentUserId = () => extractModelId(user().id).dbId;
