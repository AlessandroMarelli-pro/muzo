import { gql, GraphQLClient } from 'graphql-request';

const baseUrl =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';
const graphqlEndpoint = baseUrl.replace(/\/?$/, '') + '/graphql';

const LOGIN_PATH = '/login';
const SIGN_UP_PATH = '/sign-up';
const AUTH_PATHS = [LOGIN_PATH, SIGN_UP_PATH];

function isUnauthorizedResponse(res: Response, body: { errors?: Array<{ extensions?: { code?: string } }> }) {
  if (res.status === 401) return true;
  return body?.errors?.some((e) => e.extensions?.code === 'UNAUTHENTICATED') ?? false;
}

/** Redirect to login on 401 or when GraphQL returns errors with code UNAUTHENTICATED (e.g. 200/204 + error). */
const fetchWithAuthRedirect: typeof fetch = (input, init) => {
  return fetch(input, init).then(async (res) => {
    if (typeof window === 'undefined') return res;
    // Avoid redirect loop: never redirect when already on login or sign-up
    if (AUTH_PATHS.includes(window.location.pathname)) return res;
    if (res.status === 401) {
      window.location.href = LOGIN_PATH;
      return res;
    }
    // GraphQL often returns 200/204 with { data: null, errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] }
    const contentType = res.headers.get('content-type') ?? '';
    if (res.ok && (contentType.includes('application/json') || contentType.includes('application/graphql'))) {
      try {
        const body = (await res.clone().json()) as { errors?: Array<{ extensions?: { code?: string } }> };
        if (body && isUnauthorizedResponse(res, body)) {
          window.location.href = LOGIN_PATH;
        }
      } catch {
        // ignore parse errors
      }
    }
    return res;
  });
};

// Create a GraphQL client instance. credentials: 'include' sends cookies (Better Auth session).
export const graffleClient = new GraphQLClient(graphqlEndpoint, {
  fetch: fetchWithAuthRedirect,
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Export the gql function for use in our hooks
export { gql };
