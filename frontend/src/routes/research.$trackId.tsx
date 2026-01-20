import { Research } from '@/components/research/research';
import { useRandomTrack } from '@/services/api-hooks';
import { createFileRoute } from '@tanstack/react-router';

function ResearchTrackDetailPage() {
  const { trackId } = Route.useParams();
  const { data: randomTrack, refetch, isLoading } = useRandomTrack(trackId);


  if (!trackId || !randomTrack) {
    console.error('No trackId provided');
    return <div>Error: No track ID provided</div>;
  }

  return <Research track={randomTrack} refetch={refetch} isLoading={isLoading || !randomTrack} />;
}

export const Route = createFileRoute('/research/$trackId')({
  component: ResearchTrackDetailPage,
});
