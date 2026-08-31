import { FavoritesPage, type FavoritesTab } from '@/components/favorites/favorites-page';
import {
  favoritePlaylistQueryOptions,
  playlistRecommendationsQueryOptions,
} from '@/services/playlist-hooks';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';

function FavoritesRoute() {
  const { playlist, recommendations } = Route.useLoaderData();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <FavoritesPage
      playlist={playlist}
      recommendations={recommendations}
      tab={tab}
      onTabChange={(nextTab: FavoritesTab) =>
        navigate({ search: (previous) => ({ ...previous, tab: nextTab }) })
      }
    />
  );
}

export const Route = createFileRoute('/favorites')({
  component: FavoritesRoute,
  validateSearch: z.object({
    tab: z.enum(['tracks', 'recommendations']).default('tracks'),
  }),
  loader: async ({ context }) => {
    const favoritePlaylist = await context.queryClient.ensureQueryData(
      favoritePlaylistQueryOptions(),
    );
    const recommendations = await context.queryClient.ensureQueryData(
      playlistRecommendationsQueryOptions(favoritePlaylist.id, 20),
    );
    return { playlist: favoritePlaylist, recommendations };
  },
  preload: true,
});
