import { Home } from '@/components/home/home';
import { createFileRoute } from '@tanstack/react-router';

function HomePage() {
  return <Home />;
}

export const Route = createFileRoute('/')({
  component: HomePage,
});
