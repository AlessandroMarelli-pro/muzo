import { HiddenPage } from '@/components/hidden/hidden-page';
import { RouteError } from '@/components/route-error';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/hidden')({
  component: HiddenPage,
  errorComponent: ({ error }) => (
    <RouteError
      title="Can't load hidden tracks"
      message="Muzo couldn't reach the library service. Check that the backend is running, then try again."
      error={error}
    />
  ),
});
