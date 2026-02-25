import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD', undefined),
      db: this.configService.get<number>('REDIS_DB', 0),
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('[Redis] Max retry attempts reached');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    this.client.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    this.client.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
      console.log('[Redis] Disconnected');
    }
  }

  getClient(): Redis {
    return this.client;
  }

  /**
   * Increment a counter with expiration using sliding window algorithm.
   * Returns the current count after increment.
   */
  async incrementSlidingWindow(
    key: string,
    windowSizeMs: number,
  ): Promise<number> {
    const now = Date.now();
    const windowStart = now - windowSizeMs;

    // Use a sorted set with timestamps as scores
    const pipeline = this.client.pipeline();

    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, '-inf', windowStart);

    // Add the current timestamp
    pipeline.zadd(key, now, `${now}-${Math.random()}`);

    // Count entries in the window
    pipeline.zcard(key);

    // Set expiration on the key (slightly longer than window to handle edge cases)
    pipeline.pexpire(key, windowSizeMs + 1000);

    const results = await pipeline.exec();

    // zcard result is at index 2
    const count = results?.[2]?.[1] as number;
    return count || 0;
  }

  /**
   * Get current count in the sliding window without incrementing.
   */
  async getSlidingWindowCount(
    key: string,
    windowSizeMs: number,
  ): Promise<number> {
    const now = Date.now();
    const windowStart = now - windowSizeMs;

    // Remove old entries and count
    await this.client.zremrangebyscore(key, '-inf', windowStart);
    return this.client.zcard(key);
  }
}
