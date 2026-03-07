import { createToken } from '../../utils/create-token';

export type ThirdPartyProvider = 'youtube' | 'tidal' | 'spotify';

export interface OAuthTokenRecord {
  userId: string;
  provider: ThirdPartyProvider;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export const OAUTH_TOKEN_REPOSITORY = createToken<IOAuthTokenRepository>('OAUTH_TOKEN_REPOSITORY');

export interface IOAuthTokenRepository {
  getToken(userId: string, provider: ThirdPartyProvider): Promise<OAuthTokenRecord | null>;

  saveToken(record: OAuthTokenRecord): Promise<void>;

  updateToken(
    userId: string,
    provider: ThirdPartyProvider,
    data: {
      accessToken: string;
      refreshToken?: string | null;
      expiresAt?: Date | null;
    },
  ): Promise<void>;
}
