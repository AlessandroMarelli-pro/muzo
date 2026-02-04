import { MusicTrackId } from 'src/clean-arch/kernel/ids';

export type TrackIndexDocument = {
  trackId: MusicTrackId;
  duration: number;
  title: string;
  artist: string;
  album: string;
  year: number;
  date: string;
  genres: string[];
  subgenres: string[];
  tags: string[];
  vocalsDesc: string;
  atmosphereDesc: string[];
  contextBackground: string;
  contextImpact: string;
  tempo: number;
  key: string;
  camelotKey: string;
  valence: number;
  valenceMood: string;
  arousal: number;
  arousalMood: string;
  danceability: number;
  danceabilityFeeling: string;
};
