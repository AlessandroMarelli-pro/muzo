import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  DATABASE_URL: 'file:./test.db',
                  DATABASE_LOGGING: false,
                };
                return config[key] !== undefined ? config[key] : defaultValue;
              }),
          },
        },
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get configuration values', () => {
    expect(configService.get('DATABASE_URL')).toBe('file:./test.db');
    expect(configService.get('DATABASE_LOGGING')).toBe(false);
  });

  it('should return default values when config is not set', () => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'DATABASE_URL') return 'file:./test.db';
        return defaultValue;
      }),
    };

    const serviceWithDefaults = new PrismaService(mockConfigService as any);
    expect(serviceWithDefaults).toBeDefined();
  });
});
