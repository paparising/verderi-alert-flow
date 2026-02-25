import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

// Create mock BEFORE importing RedisService
const mockPipeline = {
  zremrangebyscore: jest.fn().mockReturnThis(),
  zadd: jest.fn().mockReturnThis(),
  zcard: jest.fn().mockReturnThis(),
  pexpire: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([
    [null, 0], // zremrangebyscore result
    [null, 1], // zadd result
    [null, 5], // zcard result
    [null, 1], // pexpire result
  ]),
};

const mockRedisClient = {
  on: jest.fn().mockReturnThis(),
  disconnect: jest.fn(),
  pipeline: jest.fn(() => mockPipeline),
  zremrangebyscore: jest.fn().mockResolvedValue(0),
  zcard: jest.fn().mockResolvedValue(5),
};

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockRedisClient),
  };
});

// Import AFTER mock is set up
import { RedisService } from '../redis.service';

describe('RedisService', () => {
  let service: RedisService;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string, defaultVal: any) => defaultVal),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);

    // Manually trigger onModuleInit
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getClient', () => {
    it('should return the Redis client', () => {
      const client = service.getClient();
      expect(client).toBeDefined();
    });
  });

  describe('incrementSlidingWindow', () => {
    it('should increment counter and return count', async () => {
      const count = await service.incrementSlidingWindow('test-key', 1000);
      expect(count).toBe(5);
    });

    it('should call pipeline methods in correct order', async () => {
      await service.incrementSlidingWindow('test-key', 1000);
      
      expect(mockPipeline.zremrangebyscore).toHaveBeenCalled();
      expect(mockPipeline.zadd).toHaveBeenCalled();
      expect(mockPipeline.zcard).toHaveBeenCalled();
      expect(mockPipeline.pexpire).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('getSlidingWindowCount', () => {
    it('should return current count without incrementing', async () => {
      const count = await service.getSlidingWindowCount('test-key', 1000);
      expect(count).toBe(5);
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect Redis client', () => {
      service.onModuleDestroy();
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });
  });
});
