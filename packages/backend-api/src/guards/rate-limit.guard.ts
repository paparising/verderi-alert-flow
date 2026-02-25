import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  limit?: number; // Max requests per window
  windowMs?: number; // Window size in milliseconds
  keyPrefix?: string; // Custom key prefix
}

/**
 * Rate limiting guard using Redis sliding window algorithm.
 * Limits requests per organization to prevent abuse.
 * 
 * Default: 10,000 requests per second per organization.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly defaultLimit: number;
  private readonly defaultWindowMs: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.defaultLimit = this.configService.get<number>('RATE_LIMIT_MAX', 10000);
    this.defaultWindowMs = this.configService.get<number>('RATE_LIMIT_WINDOW_MS', 1000);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Get rate limit options from decorator or use defaults
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    ) || {};

    const limit = options.limit ?? this.defaultLimit;
    const windowMs = options.windowMs ?? this.defaultWindowMs;
    const keyPrefix = options.keyPrefix ?? 'rate_limit';

    // Extract organization ID from various sources
    const orgId = this.extractOrgId(request);
    
    if (!orgId) {
      // If no org ID found, use IP-based rate limiting as fallback
      const ip = request.ip || request.connection?.remoteAddress || 'unknown';
      return this.checkRateLimit(`${keyPrefix}:ip:${ip}`, limit, windowMs, request);
    }

    return this.checkRateLimit(`${keyPrefix}:org:${orgId}`, limit, windowMs, request);
  }

  private async checkRateLimit(
    key: string,
    limit: number,
    windowMs: number,
    request: any,
  ): Promise<boolean> {
    try {
      const currentCount = await this.redisService.incrementSlidingWindow(key, windowMs);

      // Set rate limit headers
      request.rateLimitInfo = {
        limit,
        remaining: Math.max(0, limit - currentCount),
        reset: Math.ceil((Date.now() + windowMs) / 1000),
      };

      if (currentCount > limit) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Rate limit exceeded. Please try again later.',
            error: 'Too Many Requests',
            retryAfter: Math.ceil(windowMs / 1000),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      // If Redis is unavailable, log and allow the request (fail-open)
      console.error('[RateLimitGuard] Redis error, allowing request:', error.message);
      return true;
    }
  }

  private extractOrgId(request: any): string | null {
    // Try different sources for org ID
    
    // 1. From route params
    if (request.params?.orgId) {
      return request.params.orgId;
    }

    // 2. From query params
    if (request.query?.orgId) {
      return request.query.orgId;
    }

    // 3. From request body
    if (request.body?.orgId) {
      return request.body.orgId;
    }

    // 4. From JWT/auth user (if authentication is implemented)
    if (request.user?.orgId) {
      return request.user.orgId;
    }

    // 5. From custom header
    if (request.headers?.['x-org-id']) {
      return request.headers['x-org-id'];
    }

    return null;
  }
}
