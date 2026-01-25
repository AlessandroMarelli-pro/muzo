import { SwipePage } from '@/components/swipe/swipe-page';
import { createFileRoute } from '@tanstack/react-router';

function SwipeRoute() {

  return <SwipePage key={'swipe-page'} />;
}

export const Route = createFileRoute('/swipe/')({
  component: SwipeRoute,

});
