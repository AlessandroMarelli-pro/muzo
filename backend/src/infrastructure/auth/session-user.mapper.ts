import type { ActionContext } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';

/** Better Auth user shape (subset we need for mapping). */
export type BetterAuthSessionUser = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Maps a Better Auth session user to our domain User (ActionContext['user']).
 */
export function mapBetterAuthUserToContextUser(
  betterAuthUser: BetterAuthSessionUser,
): ActionContext['user'] {
  const parts = (betterAuthUser.name ?? '').trim().split(/\s+/);
  const firstName = parts[0] ?? 'anonymous';
  const lastName = parts.slice(1).join(' ') || 'anonymous';

  return {
    id: models.user.id(betterAuthUser.id),
    createdAt: new Date(betterAuthUser.createdAt),
    createdById: models.user.id(betterAuthUser.id),
    updatedAt: new Date(betterAuthUser.updatedAt),
    updatedById: undefined,
    email: betterAuthUser.email as ActionContext['user']['email'],
    firstName,
    lastName,
  } as ActionContext['user'];
}
