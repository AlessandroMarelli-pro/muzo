import { createAuthClient, type BetterAuthClientOptions } from 'better-auth/client';

/**
 * Creates the Better Auth client (e.g. for frontend or server-side calls).
 * Standard setup per https://better-auth.com/docs/installation — no infra.
 *
 * @param baseURL - e.g. process.env.VITE_API_URL or 'http://localhost:3000'
 * @param options - Optional extra client options
 */
export function createAppAuthClient(
  baseURL: string,
  options?: Omit<BetterAuthClientOptions, 'baseURL'>,
) {
  return createAuthClient({ baseURL, ...options });
}
