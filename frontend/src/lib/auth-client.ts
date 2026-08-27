import { createAuthClient } from 'better-auth/react';

import { API_BASE_URL as baseURL } from './api-config';

/**
 * Better Auth client for the frontend.
 * Use signIn, signUp, signOut, useSession, etc.
 * @see https://better-auth.com/docs/concepts/client
 * @see https://better-auth.com/docs/installation#create-client-instance
 */
export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    credentials: 'include',
  },
});

export const { signIn, signUp, signOut, useSession } = authClient;
