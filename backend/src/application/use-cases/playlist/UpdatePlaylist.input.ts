import { MaybeUndefined } from 'src/kernel/common';

export interface UpdatePlaylistInput {
  name: MaybeUndefined<string>;
  description: MaybeUndefined<string>;
  isPublic: MaybeUndefined<boolean>;
}
