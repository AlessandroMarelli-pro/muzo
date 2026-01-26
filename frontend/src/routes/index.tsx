import { Home } from '@/components/home/home';
import { fetchRecentlyPlayed } from '@/services/api-hooks';
import { fetchLibraryMetrics } from '@/services/metrics-hooks';
import { createFileRoute } from '@tanstack/react-router';

function HomePage() {
  return <Home />;
}
const loader = async () => {
  const recentlyPlayed = await fetchRecentlyPlayed();
  const metrics = await fetchLibraryMetrics();
  return { recentlyPlayed, metrics };
}

export const Route = createFileRoute('/')({
  component: HomePage,
  loader
});
