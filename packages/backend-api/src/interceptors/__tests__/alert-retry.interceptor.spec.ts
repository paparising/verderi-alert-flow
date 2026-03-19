import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler, ServiceUnavailableException } from '@nestjs/common';
import { of, throwError, firstValueFrom } from 'rxjs';
import { AlertRetryInterceptor } from '../alert-retry.interceptor';
import { CircuitBreakerService } from '../circuit-breaker.service';
import type { MockInstance } from 'vitest';

describe('AlertRetryInterceptor', () => {
  let interceptor: AlertRetryInterceptor;
  let circuitBreakerService: CircuitBreakerService;
  let mathRandomSpy: MockInstance;

  beforeEach(async () => {
    vi.useFakeTimers();
    
    circuitBreakerService = new CircuitBreakerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertRetryInterceptor,
        {
          provide: CircuitBreakerService,
          useValue: circuitBreakerService,
        },
      ],
    }).compile();

    interceptor = module.get<AlertRetryInterceptor>(AlertRetryInterceptor);

    mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
    vi.useRealTimers();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('Specialized Alert Retry Logic', () => {
    it('should retry with 5 max attempts for alerts', async () => {
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'POST',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

      let attemptCount = 0;
      const mockHandler = {
        handle: vi.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 4) {
            const error = new Error('Database connection timeout');
            return throwError(() => error);
          }
          return of({ id: 'alert-123', status: 'New' });
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      let resolvedValue: any;
      let rejectedError: any;
      
      result.subscribe({
        next: (value) => { resolvedValue = value; },
        error: (err) => { rejectedError = err; },
      });
      
      // Advance timers through all retry delays
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(2000);
        if (resolvedValue || rejectedError) break;
      }
      
      expect(rejectedError).toBeUndefined();
      expect(resolvedValue?.id).toBe('alert-123');
      expect(attemptCount).toBe(4);
    });

    it('should handle connection refused errors for alerts', async () => {
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'POST',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

      let attemptCount = 0;
      const mockHandler = {
        handle: vi.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            const error = new Error('ECONNREFUSED');
            return throwError(() => error);
          }
          return of({ id: 'alert-456' });
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      let resolvedValue: any;
      let rejectedError: any;
      
      result.subscribe({
        next: (value) => { resolvedValue = value; },
        error: (err) => { rejectedError = err; },
      });
      
      await vi.runAllTimersAsync();
      
      expect(rejectedError).toBeUndefined();
      expect(attemptCount).toBe(2);
    });

    it('should handle connection reset errors for alerts', async () => {
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'PATCH',
            path: '/alerts/123/status',
          }),
        }),
      } as unknown as ExecutionContext;

      let attemptCount = 0;
      const mockHandler = {
        handle: vi.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            const error = new Error('ECONNRESET');
            return throwError(() => error);
          }
          return of({ id: 'alert-123', status: 'Acknowledged' });
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      let resolvedValue: any;
      let rejectedError: any;
      
      result.subscribe({
        next: (value) => { resolvedValue = value; },
        error: (err) => { rejectedError = err; },
      });
      
      await vi.runAllTimersAsync();
      
      expect(rejectedError).toBeUndefined();
      expect(attemptCount).toBe(2);
    });

    it('should handle timeout errors for alerts', async () => {
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'GET',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

      let attemptCount = 0;
      const mockHandler = {
        handle: vi.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            const error = new Error('TimeoutError');
            error.name = 'TimeoutError';
            return throwError(() => error);
          }
          return of([]);
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      let resolvedValue: any;
      let rejectedError: any;
      
      result.subscribe({
        next: (value) => { resolvedValue = value; },
        error: (err) => { rejectedError = err; },
      });
      
      await vi.runAllTimersAsync();
      
      expect(rejectedError).toBeUndefined();
      expect(attemptCount).toBe(2);
    });

    it('should handle 5xx errors for alerts', async () => {
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'DELETE',
            path: '/alerts/123',
          }),
        }),
      } as unknown as ExecutionContext;

      let attemptCount = 0;
      const mockHandler = {
        handle: vi.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            const error = new Error('Internal Server Error');
            (error as any).status = 500;
            return throwError(() => error);
          }
          return of({ success: true });
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      let resolvedValue: any;
      let rejectedError: any;
      
      result.subscribe({
        next: (value) => { resolvedValue = value; },
        error: (err) => { rejectedError = err; },
      });
      
      await vi.runAllTimersAsync();
      
      expect(rejectedError).toBeUndefined();
      expect(attemptCount).toBe(2);
    });
  });

  describe('Alert-Specific Non-Retryable Errors', () => {
    it('should not retry on 400 for alerts', async () => {
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'POST',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

      const mockHandler = {
        handle: vi.fn().mockImplementation(() => {
          const error = new Error('Invalid alert context');
          (error as any).status = 400;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      let rejectedError: any;
      
      result.subscribe({
        next: () => {},
        error: (err) => { rejectedError = err; },
      });
      
      await vi.runAllTimersAsync();
      
      expect(rejectedError).toBeDefined();
      expect(mockHandler.handle).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401 for alerts', async () => {
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'PATCH',
            path: '/alerts/123/status',
          }),
        }),
      } as unknown as ExecutionContext;

      const mockHandler = {
        handle: vi.fn().mockImplementation(() => {
          const error = new Error('Unauthorized');
          (error as any).status = 401;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      let rejectedError: any;
      
      result.subscribe({
        next: () => {},
        error: (err) => { rejectedError = err; },
      });
      
      await vi.runAllTimersAsync();
      
      expect(rejectedError).toBeDefined();
      expect(mockHandler.handle).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 403 for alerts', async () => {
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'DELETE',
            path: '/alerts/456',
          }),
        }),
      } as unknown as ExecutionContext;

      const mockHandler = {
        handle: vi.fn().mockImplementation(() => {
          const error = new Error('Forbidden');
          (error as any).status = 403;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      let rejectedError: any;
      
      result.subscribe({
        next: () => {},
        error: (err) => { rejectedError = err; },
      });
      
      await vi.runAllTimersAsync();
      
      expect(rejectedError).toBeDefined();
      expect(mockHandler.handle).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 404 for alerts', async () => {
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'GET',
            path: '/alerts/nonexistent',
          }),
        }),
      } as unknown as ExecutionContext;

      const mockHandler = {
        handle: vi.fn().mockImplementation(() => {
          const error = new Error('Alert not found');
          (error as any).status = 404;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      let rejectedError: any;
      
      result.subscribe({
        next: () => {},
        error: (err) => { rejectedError = err; },
      });
      
      await vi.runAllTimersAsync();
      
      expect(rejectedError).toBeDefined();
      expect(mockHandler.handle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should reject when circuit breaker is open for alerts', async () => {
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'POST',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

      const mockHandler = {
        handle: vi.fn(),
      } as unknown as CallHandler;

      // Open the circuit for alerts
      for (let i = 0; i < 5; i++) {
        circuitBreakerService.recordFailure('alerts:POST:/alerts');
      }

      const result = interceptor.intercept(mockContext, mockHandler);

      await expect(firstValueFrom(result)).rejects.toThrow(ServiceUnavailableException);
    });

    it('should record failure in circuit breaker for alerts', async () => {
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'POST',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

      const mockHandler = {
        handle: vi.fn().mockImplementation(() => {
          const error = new Error('Persistent failure');
          (error as any).status = 500;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      vi.spyOn(circuitBreakerService, 'recordFailure');

      const result = interceptor.intercept(mockContext, mockHandler);

      let rejectedError: any;
      let done = false;
      
      result.subscribe({
        next: () => { done = true; },
        error: (err) => { rejectedError = err; done = true; },
      });
      
      // Advance timers to process all retries
      for (let i = 0; i < 10 && !done; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }
      
      expect(rejectedError).toBeDefined();
      expect(circuitBreakerService.recordFailure).toHaveBeenCalledWith('alerts:POST:/alerts');
    });
  });

  describe('Max Retry Attempts for Alerts', () => {
    it('should retry up to 5 times for alerts', async () => {
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'POST',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

      let attemptCount = 0;
      const mockHandler = {
        handle: vi.fn().mockImplementation(() => {
          attemptCount++;
          const error = new Error('Always fails');
          (error as any).status = 503;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      let rejectedError: any;
      let done = false;
      
      result.subscribe({
        next: () => { done = true; },
        error: (err) => { rejectedError = err; done = true; },
      });
      
      // Advance timers to process all retries
      for (let i = 0; i < 10 && !done; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }
      
      expect(rejectedError).toBeDefined();
      // 1 initial attempt + 5 retries = 6 total
      expect(attemptCount).toBe(6);
    });
  });

  describe('Faster Retry Delays for Alerts', () => {
    it('should use shorter delays for alert retries', async () => {
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'POST',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

      let attemptCount = 0;
      const mockHandler = {
        handle: vi.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            const error = new Error('Fail');
            (error as any).status = 503;
            return throwError(() => error);
          }
          return of({ id: 'alert-123' });
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      const promise = firstValueFrom(result);
      await vi.runAllTimersAsync();
      
      const value = await promise;
      expect(value).toEqual({ id: 'alert-123' });
      expect(attemptCount).toBe(3);
    });
  });

  describe('Database Connection Error Handling', () => {
    it('should retry on common database errors', async () => {
      const mockContext = {
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'GET',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

      let attemptCount = 0;
      const mockHandler = {
        handle: vi.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            const error = new Error('connection timeout exceeded');
            return throwError(() => error);
          }
          return of([]);
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      const promise = firstValueFrom(result);
      await vi.runAllTimersAsync();
      
      await promise;
      expect(attemptCount).toBe(2);
    });
  });
});



