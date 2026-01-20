import { Research } from '@/components/research/research';
import { useRandomTrack } from '@/services/api-hooks';
import { createFileRoute } from '@tanstack/react-router';

function ResearchPage() {
  console.log('ResearchPage');
  const { data: randomTrack, refetch, isLoading } = useRandomTrack();



  return <Research refetch={refetch} track={randomTrack} isLoading={isLoading || !randomTrack} />;
}

export const Route = createFileRoute('/research/')({
  component: ResearchPage,
});
