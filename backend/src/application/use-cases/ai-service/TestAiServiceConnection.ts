import axios from 'axios';

export interface TestAiServiceConnectionInput {
  url: string;
  authToken?: string | null;
}

export interface TestAiServiceConnectionResult {
  success: boolean;
  message: string;
}

/**
 * Probes a CANDIDATE ai-service URL/token before it is ever persisted -- reuses the same
 * `/api/v1/health` shape AiServerPoolAdapter's own health loop checks (5s timeout, Bearer
 * header, require body.status === 'healthy'). Called from the settings UI's "Test connection"
 * button and again inside UpdateAiServiceSettings so a broken remote config is never saved.
 */
export class TestAiServiceConnectionUseCase {
  async execute(input: TestAiServiceConnectionInput): Promise<TestAiServiceConnectionResult> {
    const url = input.url.trim();
    if (!url) {
      return { success: false, message: 'URL is required' };
    }

    try {
      const response = await axios.get(`${url.replace(/\/$/, '')}/api/v1/health`, {
        timeout: 5000,
        headers: input.authToken ? { Authorization: `Bearer ${input.authToken}` } : undefined,
      });

      const healthy = response.status === 200 && (response.data as any)?.status === 'healthy';
      return healthy
        ? { success: true, message: 'Connected' }
        : { success: false, message: `Endpoint responded but is not healthy: ${JSON.stringify(response.data)}` };
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        return { success: false, message: 'Authentication failed -- check the token' };
      }
      return { success: false, message: `Could not reach endpoint: ${error.message}` };
    }
  }
}
