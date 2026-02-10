import { Client } from '@elastic/elasticsearch';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ElasticsearchClient implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchClient.name);
  public readonly client: Client;

  constructor(private readonly configService: ConfigService) {
    const elasticsearchConfig = this.configService.get('elasticsearch');

    this.client = new Client({
      node: elasticsearchConfig.node,
      auth: elasticsearchConfig.auth,
      maxRetries: elasticsearchConfig.maxRetries,
      requestTimeout: elasticsearchConfig.requestTimeout,
      pingTimeout: elasticsearchConfig.pingTimeout,
    });
  }

  getClient() {
    return this.client;
  }

  async onModuleInit() {
    try {
      await this.client.ping();
      this.logger.log('Successfully connected to Elasticsearch');
    } catch (error) {
      this.logger.error('Failed to connect to Elasticsearch:', error);
    }
  }
}
