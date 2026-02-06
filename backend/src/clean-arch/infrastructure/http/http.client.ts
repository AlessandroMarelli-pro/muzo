import { ConfigService } from '@nestjs/config';

export class HttpClient {
  constructor(private readonly configService: ConfigService) {}

  async get(url: string) {
    const response = await axios.get(url);
    return response.data;
  }
}
