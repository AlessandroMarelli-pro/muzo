import type { ActionContext } from 'src/kernel/types/model-types';
import { Email, Name } from 'src/kernel/types/value-object';
import { models } from 'src/kernel/types/models';

/**
 * Builds a User object suitable for contextUser in tests (job data, action context, etc.).
 * Use this instead of repeating the full user shape across specs.
 *
 * @param userId - The user id without the "User:" prefix (e.g. 'user-1', 'test-user-id').
 *                 models.user.id() will produce the branded UserId.
 * @param overrides - Optional partial user to override default fields.
 */
export function makeContextUser(
  userId: string,
  overrides: Partial<ActionContext['user']> = {},
): ActionContext['user'] {
  const id = models.user.id(userId);
  const now = new Date();
  return {
    id,
    createdAt: now,
    createdById: id,
    updatedAt: now,
    updatedById: id,
    email: 'test@test.com' as Email,
    firstName: 'Test' as Name,
    lastName: 'User' as Name,
    ...overrides,
  };
}
