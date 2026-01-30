import { Maybe } from 'src/clean-arch/kernel/common';

export interface UpdatePlaylistInput {
  name: string;
  description: Maybe<string>;
  isPublic: Maybe<boolean>;
}
