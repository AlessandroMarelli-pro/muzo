import { createAuthClient } from 'better-auth/react';

// Backend URL (Better Auth is mounted on the API server). Same as GraphQL client.
const baseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

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
