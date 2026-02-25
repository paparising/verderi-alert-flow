import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Interceptor to add rate limit headers to responses.
 */
@Injectable()
export class RateLimitHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(() => {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();

        if (request.rateLimitInfo) {
          const { limit, remaining, reset } = request.rateLimitInfo;
          response.setHeader('X-RateLimit-Limit', limit);
          response.setHeader('X-RateLimit-Remaining', remaining);
          response.setHeader('X-RateLimit-Reset', reset);
        }
      }),
    );
  }
}
