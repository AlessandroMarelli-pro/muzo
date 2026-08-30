import type {
  IOAuthTokenRepository,
  ThirdPartyProvider,
} from '../../ports/repositories/IOAuthTokenRepository';

export class GetConnectedProvidersUseCase {
  constructor(private readonly oauthTokenRepository: IOAuthTokenRepository) {}

  async execute(userId: string): Promise<ThirdPartyProvider[]> {
    return this.oauthTokenRepository.listConnectedProviders(userId);
  }
}
