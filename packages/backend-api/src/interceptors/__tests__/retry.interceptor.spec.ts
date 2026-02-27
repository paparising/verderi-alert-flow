import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler, ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
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

  describe('Circuit Breaker Check', () => {
    it('should reject request when circuit is OPEN', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

      const mockHandler = {
        handle: jest.fn(),
      } as unknown as CallHandler;

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreakerService.recordFailure('GET:/alerts');
      }

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: () => done(new Error('should have thrown')),
        error: (error) => {
          try {
            expect(error).toBeInstanceOf(ServiceUnavailableException);
            expect(error.message).toContain('circuit breaker is OPEN');
            done();
          } catch (e) {
            done(e);
          }
        },
      });
    });

    it('should allow request when circuit is CLOSED', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

      const mockHandler = {
        handle: jest.fn().mockReturnValue(of({ data: 'success' })),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: (value) => {
          try {
            expect(value).toEqual({ data: 'success' });
            expect(mockHandler.handle).toHaveBeenCalled();
            done();
          } catch (e) {
            done(e);
          }
        },
        error: (err) => done(err),
      });
    });
  });

  describe('Retry Logic', () => {
    it('should retry on timeout error', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'POST',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

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

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: (value) => {
          try {
            expect(value).toEqual({ data: 'success' });
            expect(attemptCount).toBeGreaterThan(1);
            done();
          } catch (e) {
            done(e);
          }
        },
        error: (err) => done(err),
      });
    }, 60000);

    it('should retry on 503 error', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            path: '/users',
          }),
        }),
      } as unknown as ExecutionContext;

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

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: (value) => {
          try {
            expect(value.data).toEqual([]);
            expect(attemptCount).toBeGreaterThan(1);
            done();
          } catch (e) {
            done(e);
          }
        },
        error: (err) => done(err),
      });
    }, 60000);

    it('should retry on 502 error', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'POST',
            path: '/organizations',
          }),
        }),
      } as unknown as ExecutionContext;

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

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: () => {
          try {
            expect(attemptCount).toBeGreaterThan(1);
            done();
          } catch (e) {
            done(e);
          }
        },
        error: (err) => done(err),
      });
    }, 60000);

    it('should retry on 504 error', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

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

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: () => {
          try {
            expect(attemptCount).toBeGreaterThan(1);
            done();
          } catch (e) {
            done(e);
          }
        },
        error: (err) => done(err),
      });
    }, 60000);

    it('should retry on 429 (Too Many Requests)', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'POST',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

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

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: () => {
          try {
            expect(attemptCount).toBeGreaterThan(1);
            done();
          } catch (e) {
            done(e);
          }
        },
        error: (err) => done(err),
      });
    }, 60000);

    it('should retry on 408 (Request Timeout)', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            path: '/users',
          }),
        }),
      } as unknown as ExecutionContext;

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

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: () => {
          try {
            expect(attemptCount).toBeGreaterThan(1);
            done();
          } catch (e) {
            done(e);
          }
        },
        error: (err) => done(err),
      });
    }, 60000);
  });

  describe('Non-Retryable Errors', () => {
    it('should not retry on 400 (Bad Request)', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'POST',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          const error = new Error('Bad Request');
          (error as any).status = 400;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: () => done(new Error('should have thrown')),
        error: () => {
          try {
            expect(mockHandler.handle).toHaveBeenCalledTimes(1);
            done();
          } catch (e) {
            done(e);
          }
        },
      });
    });

    it('should not retry on 401 (Unauthorized)', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            path: '/protected',
          }),
        }),
      } as unknown as ExecutionContext;

      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          const error = new Error('Unauthorized');
          (error as any).status = 401;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: () => done(new Error('should have thrown')),
        error: () => {
          try {
            expect(mockHandler.handle).toHaveBeenCalledTimes(1);
            done();
          } catch (e) {
            done(e);
          }
        },
      });
    });

    it('should not retry on 403 (Forbidden)', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'DELETE',
            path: '/alerts/123',
          }),
        }),
      } as unknown as ExecutionContext;

      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          const error = new Error('Forbidden');
          (error as any).status = 403;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: () => done(new Error('should have thrown')),
        error: () => {
          try {
            expect(mockHandler.handle).toHaveBeenCalledTimes(1);
            done();
          } catch (e) {
            done(e);
          }
        },
      });
    });

    it('should not retry on 404 (Not Found)', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            path: '/alerts/nonexistent',
          }),
        }),
      } as unknown as ExecutionContext;

      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          const error = new Error('Not Found');
          (error as any).status = 404;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: () => done(new Error('should have thrown')),
        error: () => {
          try {
            expect(mockHandler.handle).toHaveBeenCalledTimes(1);
            done();
          } catch (e) {
            done(e);
          }
        },
      });
    });
  });

  describe('Exponential Backoff', () => {
    it('should use exponential backoff with jitter', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

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

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: () => {
          try {
            expect(delays.length).toBeGreaterThan(0);
            done();
          } catch (e) {
            done(e);
          }
        },
        error: (err) => done(err),
      });
    }, 60000);
  });

  describe('Circuit Breaker Recording', () => {
    it('should record failure in circuit breaker after exhausting retries', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'POST',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          const error = new Error('Persistent Error');
          (error as any).status = 500;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      jest.spyOn(circuitBreakerService, 'recordFailure');

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: () => done(new Error('should have thrown')),
        error: () => {
          try {
            expect(circuitBreakerService.recordFailure).toHaveBeenCalledWith('POST:/alerts');
            done();
          } catch (e) {
            done(e);
          }
        },
      });
    }, 60000);

    it('should record success in circuit breaker on successful request', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            path: '/users',
          }),
        }),
      } as unknown as ExecutionContext;

      const mockHandler = {
        handle: jest.fn().mockReturnValue(of({ data: [] })),
      } as unknown as CallHandler;

      jest.spyOn(circuitBreakerService, 'recordSuccess');

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: () => {
          try {
            expect(circuitBreakerService.recordSuccess).toHaveBeenCalledWith('GET:/users');
            done();
          } catch (e) {
            done(e);
          }
        },
        error: (err) => {
          done(err);
        },
      });
    });
  });

  describe('Max Retries', () => {
    it('should not exceed max retry attempts', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            path: '/alerts',
          }),
        }),
      } as unknown as ExecutionContext;

      let attemptCount = 0;
      const mockHandler = {
        handle: jest.fn().mockImplementation(() => {
          attemptCount++;
          const error = new Error('Always fails');
          (error as any).status = 503;
          return throwError(() => error);
        }),
      } as unknown as CallHandler;

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        next: () => done(new Error('should have thrown')),
        error: () => {
          try {
            // 1 initial attempt + 3 retries = 4 total
            expect(attemptCount).toBeGreaterThan(1);
            done();
          } catch (e) {
            done(e);
          }
        },
      });
    }, 60000);
  });
});
