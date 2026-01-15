import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTracksByCategories } from '@/services/api-hooks';
import { Music } from 'lucide-react';
import React, { useState } from 'react';
import { Loading } from '../loading';
import { NoData } from '../no-data';
import MusicCard from '../track/music-card';
import { Card, CardContent, CardTitle } from '../ui/card';

interface TrackListProps {
  searchQuery?: string;
  onSearchChange: (query: string) => void;
}

export const CategoriesTrackList: React.FC<TrackListProps> = ({
  searchQuery = '',
  onSearchChange,
}) => {
  const [currentCategory, setCurrentCategory] = useState<'genre' | 'subgenre'>(
    'genre',
  );
  const [genre, setGenre] = useState<string | undefined>(undefined);
  const { data: categories = [], isLoading } = useTracksByCategories(
    currentCategory,
    genre,
  );

  if (isLoading) {
    return <Loading />;
  }

  if (categories?.length === 0) {
    return (
      <NoData
        Icon={Music}
        title="No Tracks Found"
        subtitle={
          searchQuery
            ? `No tracks match "${searchQuery}"`
            : 'No tracks available in this library'
        }
        buttonAction={searchQuery ? () => onSearchChange('') : undefined}
        buttonLabel="Clear Search"
      />
    );
  }

  return (
    <div className="p-4 space-y-4 flex flex-col z-0">
      <div className="flex flex-col gap-2">
        {categories.map((category, index) => (
          <Card
            key={category.name + index}
            className="p-0 rounded-b-none gap-0 border-none"
          >
            <CardTitle className="flex flex-row  items-center justify-between p-0 px-4 w-full bg-secondary rounded-t-xl">
              <div className="flex flex-row gap-2 items-center h-9">
                <p className="text-xs font-bold uppercase">
                  {category.name.replace('_', ' ')}
                </p>
                <div className="flex ">
                  <Badge variant="secondary" className="text-[10px]">
                    {category.trackCount}
                  </Badge>
                </div>
              </div>

              {currentCategory === 'genre' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setGenre(category.name);
                    setCurrentCategory('subgenre');
                  }}
                >
                  View Subgenres
                </Button>
              )}
            </CardTitle>
            <CardContent className="p-2 bg-background border-none">
              <div>
                <div
                  className={
                    'flex flex-nowrap gap-10 max-w-screen overflow-x-scroll scroll-mb-0 bg-background'
                  }
                >
                  {category.tracks.map((track) => (
                    <MusicCard key={track.id} track={track} />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
