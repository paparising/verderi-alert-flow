import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Observable, throwError, timer, defer } from 'rxjs';
import { catchError, retry, timeout, tap } from 'rxjs/operators';
import { CircuitBreakerService } from './circuit-breaker.service';

@Injectable()
export class RetryInterceptor implements NestInterceptor {
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_DELAY = 100; // ms
  private readonly MAX_DELAY = 5000; // ms
  private readonly TIMEOUT = 30000; // ms

  constructor(private circuitBreakerService: CircuitBreakerService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const key = this.getCircuitBreakerKey(request);

    // Check circuit breaker before executing
    if (!this.circuitBreakerService.canExecute(key)) {
      return throwError(
        () =>
          new ServiceUnavailableException(
            'Service temporarily unavailable - circuit breaker is OPEN',
          ),
      );
    }

    // Use defer to ensure handler is called on each retry attempt
    return defer(() => next.handle()).pipe(
      timeout(this.TIMEOUT),
      retry({
        count: this.MAX_RETRIES,
        delay: (error, retryCount) => {
          // Only retry on specific errors (transient errors)
          if (!this.isRetryableError(error)) {
            return throwError(() => error);
          }

          // Calculate exponential backoff with jitter
          const exponentialDelay = Math.min(
            this.INITIAL_DELAY * Math.pow(2, retryCount),
            this.MAX_DELAY,
          );
          const jitter = Math.random() * 100;
          const delay = exponentialDelay + jitter;

          console.log(
            `[Retry] Attempt ${retryCount + 1} for ${key}, delay: ${Math.round(delay)}ms`,
          );

          return timer(delay);
        },
      }),
      tap(() => {
        // Record success in circuit breaker on successful response
        this.circuitBreakerService.recordSuccess(key);
      }),
      catchError((error) => {
        // Record failure in circuit breaker
        this.circuitBreakerService.recordFailure(key);
        console.error(`[RetryInterceptor] Request failed: ${key}`, {
          message: error.message,
          status: error.status,
        });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Check if error is retryable (transient)
   */
  private isRetryableError(error: any): boolean {
    // Retry on timeout
    if (error.name === 'TimeoutError') {
      return true;
    }

    // Retry on 408 (Request Timeout), 429 (Too Many Requests), 5xx errors
    const status = error.status || error.statusCode;
    if ([408, 429, 500, 502, 503, 504].includes(status)) {
      return true;
    }

    // Do not retry on client errors (4xx except 408 and 429)
    if (status && status >= 400 && status < 500) {
      return false;
    }

    return false;
  }

  /**
   * Generate circuit breaker key based on request
   */
  private getCircuitBreakerKey(request: any): string {
    const method = request.method;
    const pathname = request.path || request.url;
    return `${method}:${pathname}`;
  }
}
