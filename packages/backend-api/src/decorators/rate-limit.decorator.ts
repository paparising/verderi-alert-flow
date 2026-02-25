import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../guards/rate-limit.guard';

/**
 * Decorator to set custom rate limit options for specific endpoints.
 * 
 * @example
 * // Use default rate limit (10,000/sec)
 * @RateLimit()
 * 
 * @example
 * // Custom limit of 100 requests per 10 seconds
 * @RateLimit({ limit: 100, windowMs: 10000 })
 * 
 * @example
 * // Custom key prefix for specific endpoint
 * @RateLimit({ keyPrefix: 'alerts_create', limit: 1000 })
 */
export const RateLimit = (options: RateLimitOptions = {}) =>
  SetMetadata(RATE_LIMIT_KEY, options);

/**
 * Decorator to skip rate limiting for specific endpoints.
 */
export const SkipRateLimit = () => SetMetadata(RATE_LIMIT_KEY, { limit: Infinity });
