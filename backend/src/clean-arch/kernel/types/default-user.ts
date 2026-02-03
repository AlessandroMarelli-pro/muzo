import type { ActionContext } from 'src/clean-arch/kernel/types/model-types';
import { models } from 'src/clean-arch/kernel/types/models';

export function getAnonymousUser(): ActionContext['user'] {
  return {
    id: models.user.id('anonymous'),
    createdAt: new Date(0),
    createdById: models.user.id('anonymous'),
    updatedAt: new Date(0),
    updatedById: null,
    email: '' as ActionContext['user']['email'],
    firstName: null,
    lastName: null,
  } as ActionContext['user'];
}
