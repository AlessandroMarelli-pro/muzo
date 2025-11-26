import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const mockPrismaService = {
      checkConnection: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-value'),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status', async () => {
    const result = await controller.getHealth();

    expect(result).toHaveProperty('status', 'ok');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('database');
    expect(result.database).toHaveProperty('connected', true);
    expect(result.database).toHaveProperty('status', 'healthy');
    expect(result.database).toHaveProperty('provider', 'prisma-sqlite');
  });

  it('should return database health status', async () => {
    const result = await controller.getDatabaseHealth();

    expect(result).toHaveProperty('connected', true);
    expect(result).toHaveProperty('status', 'healthy');
    expect(result).toHaveProperty('provider', 'prisma-sqlite');
    expect(result).toHaveProperty('timestamp');
  });

  it('should handle database connection failure', async () => {
    jest.spyOn(prismaService, 'checkConnection').mockResolvedValue(false);

    const result = await controller.getHealth();

    expect(result.database).toHaveProperty('connected', false);
    expect(result.database).toHaveProperty('status', 'unhealthy');
  });
});
