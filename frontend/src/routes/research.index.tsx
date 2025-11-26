import { Loading } from '@/components/loading';
import { Research } from '@/components/research/research';
import { useRandomTrack } from '@/services/api-hooks';
import { createFileRoute } from '@tanstack/react-router';

function ResearchPage() {
  console.log('ResearchPage');
  const { data: randomTrack, refetch, isLoading } = useRandomTrack();

  if (isLoading) {
    return <Loading />;
  }
  if (!randomTrack) {
    return <div>Error: No track found</div>;
  }

  return <Research refetch={refetch} track={randomTrack} />;
}

export const Route = createFileRoute('/research/')({
  component: ResearchPage,
});
