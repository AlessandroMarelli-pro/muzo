import { queryClient } from '@/query-client';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

// Create a new router instance
const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreload: 'intent',
  // Route loaders are always invoked on preload and on navigation so React Query
  // can dedupe via its cache. Use queryClient.ensureQueryData in loaders for
  // routes that should reuse RQ cache on hover→click.
  defaultPreloadStaleTime: 0,
  context: {
    queryClient,
  },
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export { router, RouterProvider };
