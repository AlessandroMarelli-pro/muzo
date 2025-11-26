import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class GenreDistribution {
  @Field()
  genre: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class SubgenreDistribution {
  @Field()
  subgenre: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class YearDistribution {
  @Field(() => Int, { nullable: true })
  year?: number;

  @Field(() => Int, { nullable: true })
  count?: number;
}

@ObjectType()
export class FormatDistribution {
  @Field()
  format: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class ListeningStats {
  @Field(() => Int)
  totalPlays: number;

  @Field(() => Float)
  totalPlayTime: number;

  @Field(() => Float)
  averageConfidence: number;

  @Field(() => Int)
  favoriteCount: number;
}

@ObjectType()
export class TopArtist {
  @Field()
  artist: string;

  @Field(() => Int)
  trackCount: number;

  @Field(() => Float)
  totalDuration: number;

  @Field(() => Float)
  averageConfidence: number;
}

@ObjectType()
export class TopGenre {
  @Field()
  genre: string;

  @Field(() => Int)
  trackCount: number;

  @Field(() => Float)
  averageConfidence: number;

  @Field(() => Float)
  averageDuration: number;
}

@ObjectType()
export class RecentActivity {
  @Field()
  date: string;

  @Field(() => Int)
  tracksAdded: number;

  @Field(() => Int)
  tracksAnalyzed: number;
}

@ObjectType()
export class LibraryMetrics {
  @Field(() => Int)
  totalTracks: number;

  @Field(() => Float)
  totalListeningTime: number;

  @Field(() => [GenreDistribution])
  genreDistribution: GenreDistribution[];

  @Field(() => [SubgenreDistribution])
  subgenreDistribution: SubgenreDistribution[];

  @Field(() => Int)
  artistCount: number;

  @Field(() => [YearDistribution])
  yearDistribution: YearDistribution[];

  @Field(() => [FormatDistribution])
  formatDistribution: FormatDistribution[];

  @Field(() => ListeningStats)
  listeningStats: ListeningStats;

  @Field(() => [TopArtist])
  topArtists: TopArtist[];

  @Field(() => [TopGenre])
  topGenres: TopGenre[];

  @Field(() => [RecentActivity])
  recentActivity: RecentActivity[];
}
