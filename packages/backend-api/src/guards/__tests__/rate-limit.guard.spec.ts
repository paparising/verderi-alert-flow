import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard } from '../rate-limit.guard';
import { RedisService } from '../../redis/redis.service';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let redisService: jest.Mocked<RedisService>;
  let configService: jest.Mocked<ConfigService>;
  let reflector: jest.Mocked<Reflector>;

  const mockRedisService = {
    incrementSlidingWindow: jest.fn(),
    getSlidingWindowCount: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string, defaultVal: any) => defaultVal),
  };

  const mockReflector = {
    get: jest.fn(),
  };

  const createMockExecutionContext = (overrides: any = {}): ExecutionContext => {
    const mockRequest = {
      params: {},
      query: {},
      body: {},
      headers: {},
      user: null,
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      ...overrides,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        { provide: RedisService, useValue: mockRedisService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
    redisService = module.get(RedisService);
    configService = module.get(ConfigService);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow request when under rate limit', async () => {
      mockRedisService.incrementSlidingWindow.mockResolvedValue(5);
      mockReflector.get.mockReturnValue(null);

      const context = createMockExecutionContext({
        params: { orgId: 'org-123' },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRedisService.incrementSlidingWindow).toHaveBeenCalledWith(
        'rate_limit:org:org-123',
        1000,
      );
    });

    it('should throw TooManyRequests when over rate limit', async () => {
      mockRedisService.incrementSlidingWindow.mockResolvedValue(10001);
      mockReflector.get.mockReturnValue(null);

      const context = createMockExecutionContext({
        params: { orgId: 'org-123' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('should use IP-based rate limiting when no orgId found', async () => {
      mockRedisService.incrementSlidingWindow.mockResolvedValue(5);
      mockReflector.get.mockReturnValue(null);

      const context = createMockExecutionContext({
        ip: '192.168.1.1',
      });

      await guard.canActivate(context);

      expect(mockRedisService.incrementSlidingWindow).toHaveBeenCalledWith(
        'rate_limit:ip:192.168.1.1',
        1000,
      );
    });

    it('should extract orgId from query params', async () => {
      mockRedisService.incrementSlidingWindow.mockResolvedValue(5);
      mockReflector.get.mockReturnValue(null);

      const context = createMockExecutionContext({
        query: { orgId: 'org-from-query' },
      });

      await guard.canActivate(context);

      expect(mockRedisService.incrementSlidingWindow).toHaveBeenCalledWith(
        'rate_limit:org:org-from-query',
        1000,
      );
    });

    it('should extract orgId from request body', async () => {
      mockRedisService.incrementSlidingWindow.mockResolvedValue(5);
      mockReflector.get.mockReturnValue(null);

      const context = createMockExecutionContext({
        body: { orgId: 'org-from-body' },
      });

      await guard.canActivate(context);

      expect(mockRedisService.incrementSlidingWindow).toHaveBeenCalledWith(
        'rate_limit:org:org-from-body',
        1000,
      );
    });

    it('should extract orgId from x-org-id header', async () => {
      mockRedisService.incrementSlidingWindow.mockResolvedValue(5);
      mockReflector.get.mockReturnValue(null);

      const context = createMockExecutionContext({
        headers: { 'x-org-id': 'org-from-header' },
      });

      await guard.canActivate(context);

      expect(mockRedisService.incrementSlidingWindow).toHaveBeenCalledWith(
        'rate_limit:org:org-from-header',
        1000,
      );
    });

    it('should use custom rate limit options from decorator', async () => {
      mockRedisService.incrementSlidingWindow.mockResolvedValue(50);
      mockReflector.get.mockReturnValue({ limit: 100, windowMs: 5000, keyPrefix: 'custom' });

      const context = createMockExecutionContext({
        params: { orgId: 'org-123' },
      });

      await guard.canActivate(context);

      expect(mockRedisService.incrementSlidingWindow).toHaveBeenCalledWith(
        'custom:org:org-123',
        5000,
      );
    });

    it('should allow request (fail-open) when Redis is unavailable', async () => {
      mockRedisService.incrementSlidingWindow.mockRejectedValue(new Error('Redis connection failed'));
      mockReflector.get.mockReturnValue(null);

      const context = createMockExecutionContext({
        params: { orgId: 'org-123' },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should set rateLimitInfo on request', async () => {
      mockRedisService.incrementSlidingWindow.mockResolvedValue(5);
      mockReflector.get.mockReturnValue(null);

      const mockRequest = {
        params: { orgId: 'org-123' },
        query: {},
        body: {},
        headers: {},
        user: null,
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      await guard.canActivate(context);

      expect(mockRequest).toHaveProperty('rateLimitInfo');
      expect(mockRequest['rateLimitInfo']).toEqual({
        limit: 10000,
        remaining: 9995,
        reset: expect.any(Number),
      });
    });
  });
});
