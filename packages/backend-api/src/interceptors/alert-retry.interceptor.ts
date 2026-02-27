import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Observable, throwError, timer, defer } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { CircuitBreakerService } from './circuit-breaker.service';

/**
 * Specialized interceptor for alert operations with more aggressive retry strategy
 */
@Injectable()
export class AlertRetryInterceptor implements NestInterceptor {
  private readonly MAX_RETRIES = 5;
  private readonly INITIAL_DELAY = 50; // ms
  private readonly MAX_DELAY = 3000; // ms

  constructor(private circuitBreakerService: CircuitBreakerService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const key = `alerts:${request.method}:${request.path}`;

    // Check circuit breaker before executing
    if (!this.circuitBreakerService.canExecute(key)) {
      return throwError(
        () =>
          new ServiceUnavailableException(
            'Alert service temporarily unavailable - too many failures',
          ),
      );
    }

    // Use defer to ensure handler is called on each retry attempt
    return defer(() => next.handle()).pipe(
      retry({
        count: this.MAX_RETRIES,
        delay: (error, retryCount) => {
          // Only retry on specific alert-related transient errors
          if (!this.isAlertRetryableError(error)) {
            return throwError(() => error);
          }

          // Calculate exponential backoff
          const exponentialDelay = Math.min(
            this.INITIAL_DELAY * Math.pow(2, retryCount),
            this.MAX_DELAY,
          );
          const jitter = Math.random() * 50;
          const delay = exponentialDelay + jitter;

          console.log(
            `[AlertRetry] Attempt ${retryCount + 1}/${this.MAX_RETRIES} for ${key}, delay: ${Math.round(delay)}ms`,
          );

          return timer(delay);
        },
      }),
      catchError((error) => {
        // Record failure
        this.circuitBreakerService.recordFailure(key);
        console.error(`[AlertRetryInterceptor] Alert operation failed: ${key}`, {
          message: error.message,
          status: error.status,
        });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Check if error is retryable for alert operations
   * Alert operations should retry on database connection issues, timeouts, and service unavailability
   */
  private isAlertRetryableError(error: any): boolean {
    const status = error.status || error.statusCode;
    const message = error.message || '';

    // Retry on timeout
    if (error.name === 'TimeoutError') {
      return true;
    }

    // Retry on database connection errors
    if (
      message.includes('ECONNREFUSED') ||
      message.includes('ECONNRESET') ||
      message.includes('connection') ||
      message.includes('timeout')
    ) {
      return true;
    }

    // Retry on specific HTTP status codes
    if ([408, 429, 500, 502, 503, 504].includes(status)) {
      return true;
    }

    return false;
  }
}
