import { createToken } from '../../utils/create-token';

export interface Id3Tags {
  purl?: string | null; // YouTube URL
  url?: string | null; // Tidal/Spotify URL
  title?: string;
  artist?: string;
  album?: string;
}

export const ID3_READER = createToken<IId3Reader>('ID3_READER');

export interface IId3Reader {
  readId3Tags(filePath: string): Promise<Id3Tags>;
}
