/**
 * Example: Using CircuitBreakerService in Custom Services
 *
 * While the CircuitBreakerService is primarily used in the global interceptors,
 * you can also inject it into your own services for fine-grained control over
 * specific external service calls.
 */

import { Injectable } from '@nestjs/common';
import { CircuitBreakerService, CircuitBreakerState } from '../interceptors';

@Injectable()
export class ExternalServiceClient {
  constructor(private circuitBreaker: CircuitBreakerService) {}

  /**
   * Example: Calling an external API with circuit breaker protection
   */
  async callExternalAPI(endpoint: string, data: any): Promise<any> {
    const key = `external:${endpoint}`;

    // Check if circuit breaker allows the call
    if (!this.circuitBreaker.canExecute(key)) {
      throw new Error(`Circuit breaker is OPEN for ${endpoint}`);
    }

    try {
      // Make the actual call
      const result = await this.makeHttpCall(endpoint, data);

      // Record success
      this.circuitBreaker.recordSuccess(key);

      return result;
    } catch (error) {
      // Record failure
      this.circuitBreaker.recordFailure(key);

      // Get current metrics for logging
      const metrics = this.circuitBreaker.getMetrics(key);
      console.error(`Call to ${endpoint} failed. Metrics:`, metrics);

      throw error;
    }
  }

  /**
   * Example: Using circuit breaker with retry logic
   */
  async callWithRetry(endpoint: string, data: any, maxRetries: number = 3): Promise<any> {
    const key = `external:${endpoint}`;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (!this.circuitBreaker.canExecute(key)) {
          throw new Error(`Circuit breaker is OPEN for ${endpoint}`);
        }

        const result = await this.makeHttpCall(endpoint, data);
        this.circuitBreaker.recordSuccess(key);
        return result;
      } catch (error) {
        this.circuitBreaker.recordFailure(key);

        // If it's the last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw error;
        }

        // Otherwise, wait and retry
        const delay = Math.min(100 * Math.pow(2, attempt), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Example: Checking circuit breaker state before making calls
   */
  async monitoredCall(endpoint: string, data: any): Promise<any> {
    const key = `external:${endpoint}`;
    const metrics = this.circuitBreaker.getMetrics(key);

    console.log(`Circuit breaker state for ${endpoint}:`, metrics);

    if (metrics.state === CircuitBreakerState.OPEN) {
      console.warn(`Service ${endpoint} is currently unavailable`);
      // Maybe return cached data or use fallback
      return this.getCachedData(endpoint);
    }

    try {
      const result = await this.makeHttpCall(endpoint, data);
      this.circuitBreaker.recordSuccess(key);
      return result;
    } catch (error) {
      this.circuitBreaker.recordFailure(key);
      throw error;
    }
  }

  // Mock methods - replace with actual HTTP calls
  private async makeHttpCall(endpoint: string, data: any): Promise<any> {
    // Your actual HTTP call here
    console.log(`Making HTTP call to ${endpoint}`);
    // return await httpClient.post(endpoint, data);
  }

  private getCachedData(endpoint: string): any {
    // Your fallback/cache logic here
    return { cached: true, endpoint };
  }
}

/**
 * Example Usage in Other Services
 */
@Injectable()
export class YourBusinessService {
  constructor(private externalClient: ExternalServiceClient) {}

  async doSomething(): Promise<void> {
    try {
      // This call is protected by circuit breaker
      const data = await this.externalClient.callExternalAPI('/api/users', { name: 'John' });
      console.log('Success:', data);
    } catch (error) {
      console.error('Failed:', error.message);
      // Handle error appropriately
    }
  }
}

/**
 * Testing Circuit Breaker Behavior
 *
 * Integration Test Example:
 */

describe('CircuitBreaker', () => {
  let service: ExternalServiceClient;
  let circuitBreaker: CircuitBreakerService;

  beforeEach(() => {
    circuitBreaker = new CircuitBreakerService();
    service = new ExternalServiceClient(circuitBreaker);
  });

  it('should allow requests when circuit is CLOSED', async () => {
    const key = 'test:endpoint';

    // Circuit should be CLOSED by default
    expect(circuitBreaker.canExecute(key)).toBe(true);
  });

  it('should OPEN circuit after threshold failures', async () => {
    const key = 'test:endpoint';

    // Record 5 failures (default threshold)
    for (let i = 0; i < 5; i++) {
      circuitBreaker.recordFailure(key);
    }

    // Circuit should now be OPEN
    expect(circuitBreaker.canExecute(key)).toBe(false);
  });

  it('should allow requests in HALF_OPEN state', async () => {
    const key = 'test:endpoint';

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      circuitBreaker.recordFailure(key);
    }

    // Simulate timeout passage (in real code, this is automatic)
    const metrics = circuitBreaker.getMetrics(key);
    expect(metrics.state).toBe(CircuitBreakerState.OPEN);

    // After timeout, should attempt recovery (HALF_OPEN)
    // In implementation, this is checked in canExecute()
    expect(circuitBreaker.canExecute(key)).toBe(false); // Still open until timeout
  });

  it('should CLOSE circuit after successes in HALF_OPEN state', async () => {
    const key = 'test:endpoint';

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      circuitBreaker.recordFailure(key);
    }

    // Simulate recovery process
    circuitBreaker.recordSuccess(key);
    circuitBreaker.recordSuccess(key); // 2 successes should close circuit

    // Circuit should now be CLOSED
    expect(circuitBreaker.canExecute(key)).toBe(true);
  });
});
