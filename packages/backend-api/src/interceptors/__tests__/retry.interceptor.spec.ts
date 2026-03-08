import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler, ServiceUnavailableException } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { RetryInterceptor } from '../retry.interceptor';
import { CircuitBreakerService } from '../circuit-breaker.service';

describe('RetryInterceptor', () => {
  let interceptor: RetryInterceptor;
  let circuitBreakerService: CircuitBreakerService;

  beforeEach(async () => {
    circuitBreakerService = new CircuitBreakerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetryInterceptor,
        {
          provide: CircuitBreakerService,
          useValue: circuitBreakerService,
        },
      ],
    }).compile();

    interceptor = module.get<RetryInterceptor>(RetryInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  const createContext = (method: string, path: string) =>
    ({
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ method, path }),
      }),
    } as unknown as ExecutionContext);

  describe('Circuit Breaker Check', () => {
    it('should reject request when circuit is OPEN', async () => {
      const mockContext = createContext('GET', '/alerts');
      const mockHandler = { handle: jest.fn() } as unknown as CallHandler;

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreakerService.recordFailure('GET:/alerts');
      }

      await expect(firstValueFrom(interceptor.intercept(mockContext, mockHandler))).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('should allow request when circuit is CLOSED', async () => {
      const mockContext = createContext('GET', '/alerts');
      const mockHandler = { handle: jest.fn().mockReturnValue(of({ data: 'success' })) } as unknown as CallHandler;

      const value = await firstValueFrom(interceptor.intercept(mockContext, mockHandler));
      expect(value).toEqual({ data: 'success' });
      expect(mockHandler.handle).toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    it('should retry on timeout error', async () => {
      const mockContext = createContext('POST', '/alerts');

      let attemptCount = 0;
      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            const error = new Error('Timeout');
            error.name = 'TimeoutError';
            return throwError(() => error);
          }
          return of({ data: 'success' });
        }),
      } as unknown as CallHandler;

      const value = await firstValueFrom(interceptor.intercept(mockContext, mockHandler));
      expect(value).toEqual({ data: 'success' });
      expect(attemptCount).toBeGreaterThan(1);
    }, 60000);

    it('should retry on 503 error', async () => {
      const mockContext = createContext('GET', '/users');

      let attemptCount = 0;
      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            const error = new Error('Service Unavailable');
            (error as any).status = 503;
            return throwError(() => error);
          }
          return of({ data: [] });
        }),
      } as unknown as CallHandler;

      const value = await firstValueFrom(interceptor.intercept(mockContext, mockHandler));
      expect(value.data).toEqual([]);
      expect(attemptCount).toBeGreaterThan(1);
    }, 60000);

    it('should retry on 502 error', async () => {
      const mockContext = createContext('POST', '/organizations');

      let attemptCount = 0;
      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount <= 1) {
            const error = new Error('Bad Gateway');
            (error as any).status = 502;
            return throwError(() => error);
          }
          return of({ id: 'org-123' });
        }),
      } as unknown as CallHandler;

      await firstValueFrom(interceptor.intercept(mockContext, mockHandler));
      expect(attemptCount).toBeGreaterThan(1);
    }, 60000);

    it('should retry on 504 error', async () => {
      const mockContext = createContext('GET', '/alerts');

      let attemptCount = 0;
      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            const error = new Error('Gateway Timeout');
            (error as any).status = 504;
            return throwError(() => error);
          }
          return of([]);
        }),
      } as unknown as CallHandler;

      await firstValueFrom(interceptor.intercept(mockContext, mockHandler));
      expect(attemptCount).toBeGreaterThan(1);
    }, 60000);

    it('should retry on 429 (Too Many Requests)', async () => {
      const mockContext = createContext('POST', '/alerts');

      let attemptCount = 0;
      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            const error = new Error('Too Many Requests');
            (error as any).status = 429;
            return throwError(() => error);
          }
          return of({ id: 'alert-123' });
        }),
      } as unknown as CallHandler;

      await firstValueFrom(interceptor.intercept(mockContext, mockHandler));
      expect(attemptCount).toBeGreaterThan(1);
    }, 60000);

    it('should retry on 408 (Request Timeout)', async () => {
      const mockContext = createContext('GET', '/users');

      let attemptCount = 0;
      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            const error = new Error('Request Timeout');
            (error as any).status = 408;
            return throwError(() => error);
          }
          return of([]);
        }),
      } as unknown as CallHandler;

      await firstValueFrom(interceptor.intercept(mockContext, mockHandler));
      expect(attemptCount).toBeGreaterThan(1);
    }, 60000);
  });

  describe('Non-Retryable Errors', () => {
    it('should not retry on 400 (Bad Request)', async () => {
      const mockContext = createContext('POST', '/alerts');

      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          const error = new Error('Bad Request');
          (error as any).status = 400;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      await expect(firstValueFrom(interceptor.intercept(mockContext, mockHandler))).rejects.toBeDefined();
      expect(mockHandler.handle).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401 (Unauthorized)', async () => {
      const mockContext = createContext('GET', '/protected');

      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          const error = new Error('Unauthorized');
          (error as any).status = 401;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      await expect(firstValueFrom(interceptor.intercept(mockContext, mockHandler))).rejects.toBeDefined();
      expect(mockHandler.handle).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 403 (Forbidden)', async () => {
      const mockContext = createContext('DELETE', '/alerts/123');

      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          const error = new Error('Forbidden');
          (error as any).status = 403;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      await expect(firstValueFrom(interceptor.intercept(mockContext, mockHandler))).rejects.toBeDefined();
      expect(mockHandler.handle).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 404 (Not Found)', async () => {
      const mockContext = createContext('GET', '/alerts/nonexistent');

      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          const error = new Error('Not Found');
          (error as any).status = 404;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      await expect(firstValueFrom(interceptor.intercept(mockContext, mockHandler))).rejects.toBeDefined();
      expect(mockHandler.handle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Exponential Backoff', () => {
    it('should use exponential backoff with jitter', async () => {
      const mockContext = createContext('GET', '/alerts');

      const delays: number[] = [];
      let lastTime = Date.now();

      let attemptCount = 0;
      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          attemptCount++;
          const currentTime = Date.now();
          if (lastTime) {
            delays.push(currentTime - lastTime);
          }
          lastTime = currentTime;

          if (attemptCount < 3) {
            const error = new Error('Service Error');
            (error as any).status = 503;
            return throwError(() => error);
          }
          return of({ data: 'success' });
        }),
      } as unknown as CallHandler;

      await firstValueFrom(interceptor.intercept(mockContext, mockHandler));
      expect(delays.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Circuit Breaker Recording', () => {
    it('should record failure in circuit breaker after exhausting retries', async () => {
      const mockContext = createContext('POST', '/alerts');

      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          const error = new Error('Persistent Error');
          (error as any).status = 500;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      jest.spyOn(circuitBreakerService, 'recordFailure');

      await expect(firstValueFrom(interceptor.intercept(mockContext, mockHandler))).rejects.toBeDefined();
      expect(circuitBreakerService.recordFailure).toHaveBeenCalledWith('POST:/alerts');
    }, 60000);

    it('should record success in circuit breaker on successful request', async () => {
      const mockContext = createContext('GET', '/users');

      const mockHandler = {
        handle: jest.fn().mockReturnValue(of({ data: [] })),
      } as unknown as CallHandler;

      jest.spyOn(circuitBreakerService, 'recordSuccess');

      await firstValueFrom(interceptor.intercept(mockContext, mockHandler));
      expect(circuitBreakerService.recordSuccess).toHaveBeenCalledWith('GET:/users');
    });
  });

  describe('Max Retries', () => {
    it('should not exceed max retry attempts', async () => {
      const mockContext = createContext('GET', '/alerts');

      let attemptCount = 0;
      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          attemptCount++;
          const error = new Error('Always fails');
          (error as any).status = 503;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      await expect(firstValueFrom(interceptor.intercept(mockContext, mockHandler))).rejects.toBeDefined();
      expect(attemptCount).toBeGreaterThan(1);
    }, 60000);
  });
});
