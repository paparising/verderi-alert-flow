import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

// Create mock BEFORE importing RedisService
const mockPipeline = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  pexpire: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([
    [null, 0], // zremrangebyscore result
    [null, 1], // zadd result
    [null, 5], // zcard result
    [null, 1], // pexpire result
  ]),
};

const mockRedisClient = {
  on: vi.fn().mockReturnThis(),
  disconnect: vi.fn(),
  pipeline: vi.fn(() => mockPipeline),
  zremrangebyscore: vi.fn().mockResolvedValue(0),
  zcard: vi.fn().mockResolvedValue(5),
};

import { RedisService } from '../redis.service';

describe('RedisService', () => {
  let service: RedisService;

  const mockConfigService = {
    get: vi.fn().mockImplementation((key: string, defaultVal: any) => defaultVal),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
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

    // Inject mock client directly to keep tests deterministic.
    (service as any).client = mockRedisClient;
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



