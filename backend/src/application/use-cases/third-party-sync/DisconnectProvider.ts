import type {
  IOAuthTokenRepository,
  ThirdPartyProvider,
} from '../../ports/repositories/IOAuthTokenRepository';

export class DisconnectProviderUseCase {
  constructor(private readonly oauthTokenRepository: IOAuthTokenRepository) {}

  async execute(userId: string, provider: ThirdPartyProvider): Promise<void> {
    await this.oauthTokenRepository.deleteToken(userId, provider);
  }
}
