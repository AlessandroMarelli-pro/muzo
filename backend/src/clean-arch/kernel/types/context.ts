import { AsyncLocalStorage } from 'node:async_hooks';
import { fail } from '../common';

import { ActionContext } from './domain-types';

export const als = new AsyncLocalStorage<ActionContext>();

export const now = () => als.getStore()?.now ?? fail('missing action context');

export const user = () =>
  als.getStore()?.user ?? fail('missing action context');
