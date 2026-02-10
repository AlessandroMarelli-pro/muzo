import { Maybe } from 'src/kernel/common';

export interface UpdatePlaylistInput {
  name?: string;
  description?: Maybe<string>;
  isPublic?: Maybe<boolean>;
}
