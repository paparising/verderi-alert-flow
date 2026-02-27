import { Injectable } from '@nestjs/common';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation, requests pass through
  OPEN = 'OPEN',         // Failing, requests are rejected
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  successThreshold: number; // Number of successes in half-open before closing
  timeout: number; // Time in ms before transitioning from open to half-open
}

@Injectable()
export class CircuitBreakerService {
  private circuits = new Map<string, CircuitBreakerState>();
  private failureCounts = new Map<string, number>();
  private successCounts = new Map<string, number>();
  private lastFailureTime = new Map<string, number>();
  private readonly config: CircuitBreakerConfig;

  constructor() {
    this.config = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 60 seconds
    };
  }

  /**
   * Get current time - can be mocked in tests
   */
  protected getCurrentTime(): number {
    return Date.now();
  }

  /**
   * Check if a request should be allowed based on circuit breaker state
   */
  canExecute(key: string): boolean {
    const state = this.getState(key);

    if (state === CircuitBreakerState.CLOSED) {
      return true;
    }

    if (state === CircuitBreakerState.OPEN) {
      const lastFailure = this.lastFailureTime.get(key) || 0;
      const timeSinceLastFailure = this.getCurrentTime() - lastFailure;

      if (timeSinceLastFailure >= this.config.timeout) {
        this.setState(key, CircuitBreakerState.HALF_OPEN);
        this.successCounts.set(key, 0);
        return true;
      }

      return false;
    }

    if (state === CircuitBreakerState.HALF_OPEN) {
      return true;
    }

    return false;
  }

  /**
   * Record a successful request
   */
  recordSuccess(key: string): void {
    const state = this.getState(key);

    if (state === CircuitBreakerState.HALF_OPEN) {
      const successCount = (this.successCounts.get(key) || 0) + 1;
      this.successCounts.set(key, successCount);

      if (successCount >= this.config.successThreshold) {
        this.reset(key);
      }
    } else if (state === CircuitBreakerState.CLOSED) {
      this.failureCounts.set(key, 0);
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(key: string): void {
    this.lastFailureTime.set(key, this.getCurrentTime());

    const failureCount = (this.failureCounts.get(key) || 0) + 1;
    this.failureCounts.set(key, failureCount);

    if (failureCount >= this.config.failureThreshold) {
      this.setState(key, CircuitBreakerState.OPEN);
    }
  }

  /**
   * Get the current state of the circuit breaker
   */
  private getState(key: string): CircuitBreakerState {
    return this.circuits.get(key) || CircuitBreakerState.CLOSED;
  }

  /**
   * Set the state of the circuit breaker
   */
  private setState(key: string, state: CircuitBreakerState): void {
    this.circuits.set(key, state);
    console.log(
      `[CircuitBreaker] ${key} transitioned to ${state}`,
    );
  }

  /**
   * Reset the circuit breaker to closed state
   */
  private reset(key: string): void {
    this.circuits.delete(key);
    this.failureCounts.set(key, 0);
    this.successCounts.set(key, 0);
    this.lastFailureTime.delete(key);
    console.log(`[CircuitBreaker] ${key} reset to CLOSED`);
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics(key: string) {
    return {
      state: this.getState(key),
      failures: this.failureCounts.get(key) || 0,
      successes: this.successCounts.get(key) || 0,
      lastFailure: this.lastFailureTime.get(key),
    };
  }
}
