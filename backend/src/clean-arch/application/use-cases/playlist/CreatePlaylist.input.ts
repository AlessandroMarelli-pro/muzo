import { Maybe } from 'src/clean-arch/kernel/common';

export interface CreatePlaylistInput {
  name: string;
  description: Maybe<string>;
  isPublic: Maybe<boolean>;
}
