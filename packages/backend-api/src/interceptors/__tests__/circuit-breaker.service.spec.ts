import { CircuitBreakerService, CircuitBreakerState } from '../circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let currentTime: number;

  beforeEach(() => {
    service = new CircuitBreakerService();
    currentTime = 0;
    jest.spyOn(service, 'getCurrentTime' as any).mockImplementation(() => currentTime);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('canExecute', () => {
    it('should allow execution when circuit is CLOSED', () => {
      const key = 'test:endpoint';
      expect(service.canExecute(key)).toBe(true);
    });

    it('should reject execution when circuit is OPEN', () => {
      const key = 'test:endpoint';

      // Record 5 failures to open circuit
      for (let i = 0; i < 5; i++) {
        service.recordFailure(key);
      }

      expect(service.canExecute(key)).toBe(false);
    });

    it('should allow execution in HALF_OPEN state after timeout', () => {
      const key = 'test:endpoint';

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        service.recordFailure(key);
      }

      expect(service.canExecute(key)).toBe(false);

      // Advance time past timeout (60 seconds)
      currentTime += 61000;

      // Should now allow execution (HALF_OPEN state)
      expect(service.canExecute(key)).toBe(true);
    });
  });

  describe('recordSuccess', () => {
    it('should reset circuit when in CLOSED state', () => {
      const key = 'test:endpoint';

      service.recordFailure(key);
      expect(service.getMetrics(key).failures).toBe(1);

      service.recordSuccess(key);
      expect(service.getMetrics(key).failures).toBe(0);
    });

    it('should increment success count in HALF_OPEN state', () => {
      const key = 'test:endpoint';

      // Open circuit
      for (let i = 0; i < 5; i++) {
        service.recordFailure(key);
      }

      // Fast forward past timeout to enter HALF_OPEN
      currentTime += 61000;
      service.canExecute(key);

      // Record success
      service.recordSuccess(key);
      expect(service.getMetrics(key).successes).toBe(1);
    });

    it('should close circuit after threshold successes in HALF_OPEN', () => {
      const key = 'test:endpoint';

      // Open circuit (5 failures)
      for (let i = 0; i < 5; i++) {
        service.recordFailure(key);
      }

      // Enter HALF_OPEN after timeout
      currentTime += 61000;
      service.canExecute(key);

      // Record 2 successes (threshold) to close
      service.recordSuccess(key);
      service.recordSuccess(key);

      // Circuit should be closed now
      expect(service.canExecute(key)).toBe(true);
      expect(service.getMetrics(key).failures).toBe(0);
    });
  });

  describe('recordFailure', () => {
    it('should increment failure count', () => {
      const key = 'test:endpoint';

      service.recordFailure(key);
      expect(service.getMetrics(key).failures).toBe(1);

      service.recordFailure(key);
      expect(service.getMetrics(key).failures).toBe(2);
    });

    it('should open circuit after threshold failures', () => {
      const key = 'test:endpoint';

      // Record 5 failures
      for (let i = 0; i < 5; i++) {
        service.recordFailure(key);
      }

      expect(service.canExecute(key)).toBe(false);
      expect(service.getMetrics(key).state).toBe(CircuitBreakerState.OPEN);
    });

    it('should update lastFailureTime', () => {
      const key = 'test:endpoint';

      service.recordFailure(key);
      const metrics1 = service.getMetrics(key);

      currentTime += 1000;

      service.recordFailure(key);
      const metrics2 = service.getMetrics(key);

      expect(metrics2.lastFailure).toBeGreaterThan(metrics1.lastFailure || 0);
    });
  });

  describe('getMetrics', () => {
    it('should return correct metrics in CLOSED state', () => {
      const key = 'test:endpoint';

      const metrics = service.getMetrics(key);

      expect(metrics).toEqual({
        state: CircuitBreakerState.CLOSED,
        failures: 0,
        successes: 0,
        lastFailure: undefined,
      });
    });

    it('should return correct metrics in OPEN state', () => {
      const key = 'test:endpoint';

      for (let i = 0; i < 5; i++) {
        service.recordFailure(key);
      }

      const metrics = service.getMetrics(key);

      expect(metrics.state).toBe(CircuitBreakerState.OPEN);
      expect(metrics.failures).toBe(5);
      expect(metrics.lastFailure).toBeDefined();
    });

    it('should return correct metrics in HALF_OPEN state', () => {
      const key = 'test:endpoint';

      // Open circuit
      for (let i = 0; i < 5; i++) {
        service.recordFailure(key);
      }

      // Enter HALF_OPEN
      currentTime += 61000;
      service.canExecute(key);

      const metrics = service.getMetrics(key);
      expect(metrics.state).toBe(CircuitBreakerState.HALF_OPEN);
    });
  });

  describe('State Transitions', () => {
    const key = 'test:endpoint';

    it('should transition: CLOSED -> OPEN -> HALF_OPEN -> CLOSED', () => {
      // Start: CLOSED
      expect(service.getMetrics(key).state).toBe(CircuitBreakerState.CLOSED);

      // Open circuit with 5 failures
      for (let i = 0; i < 5; i++) {
        service.recordFailure(key);
      }
      expect(service.getMetrics(key).state).toBe(CircuitBreakerState.OPEN);

      // Wait for timeout
      currentTime += 61000;

      // Enter HALF_OPEN
      service.canExecute(key);
      expect(service.getMetrics(key).state).toBe(CircuitBreakerState.HALF_OPEN);

      // Record 2 successes to close
      service.recordSuccess(key);
      service.recordSuccess(key);
      expect(service.getMetrics(key).state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should reopen circuit if failure happens in HALF_OPEN', () => {
      // Open circuit
      for (let i = 0; i < 5; i++) {
        service.recordFailure(key);
      }

      // Enter HALF_OPEN
      currentTime += 61000;
      service.canExecute(key);

      // Record a failure (should reopen)
      service.recordFailure(key);

      expect(service.canExecute(key)).toBe(false);
      expect(service.getMetrics(key).state).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('Multiple Keys', () => {
    it('should maintain separate state for different keys', () => {
      const key1 = 'endpoint:1';
      const key2 = 'endpoint:2';

      // Fail key1
      for (let i = 0; i < 5; i++) {
        service.recordFailure(key1);
      }

      // key1 should be open, key2 should be closed
      expect(service.canExecute(key1)).toBe(false);
      expect(service.canExecute(key2)).toBe(true);
    });

    it('should track metrics independently per key', () => {
      const key1 = 'endpoint:1';
      const key2 = 'endpoint:2';

      service.recordFailure(key1);
      service.recordFailure(key1);
      service.recordFailure(key2);

      expect(service.getMetrics(key1).failures).toBe(2);
      expect(service.getMetrics(key2).failures).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid failures', () => {
      const key = 'test:endpoint';

      for (let i = 0; i < 10; i++) {
        service.recordFailure(key);
      }

      expect(service.canExecute(key)).toBe(false);
      expect(service.getMetrics(key).failures).toBeGreaterThanOrEqual(5);
    });

    it('should handle alternating success and failure in CLOSED', () => {
      const key = 'test:endpoint';

      for (let i = 0; i < 3; i++) {
        service.recordSuccess(key);
        service.recordFailure(key);
      }

      // Should still be closed (not enough consecutive failures)
      expect(service.canExecute(key)).toBe(true);
    });

    it('should recover gracefully from HALF_OPEN to CLOSED', () => {
      const key = 'test:endpoint';

      // Open
      for (let i = 0; i < 5; i++) {
        service.recordFailure(key);
      }

      // Enter HALF_OPEN after timeout
      currentTime += 61000;
      service.canExecute(key);

      // Succeed twice to close
      service.recordSuccess(key);
      service.recordSuccess(key);

      // Can execute and is closed
      expect(service.canExecute(key)).toBe(true);
      expect(service.getMetrics(key).state).toBe(CircuitBreakerState.CLOSED);
      expect(service.getMetrics(key).failures).toBe(0);
    });
  });

  describe('Timeout Behavior', () => {
    it('should not enter HALF_OPEN before timeout', () => {
      const key = 'test:endpoint';

      // Open circuit
      for (let i = 0; i < 5; i++) {
        service.recordFailure(key);
      }

      // Advance time but less than timeout
      currentTime += 59000;

      expect(service.canExecute(key)).toBe(false);
    });

    it('should enter HALF_OPEN exactly at timeout', () => {
      const key = 'test:endpoint';

      // Open circuit
      for (let i = 0; i < 5; i++) {
        service.recordFailure(key);
      }

      // Advance exactly to timeout
      currentTime += 60000;

      expect(service.canExecute(key)).toBe(true);
      expect(service.getMetrics(key).state).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should handle multiple timeout periods', () => {
      const key = 'test:endpoint';

      // Cycle 1: Open -> HALF_OPEN -> Open again
      for (let i = 0; i < 5; i++) {
        service.recordFailure(key);
      }

      currentTime += 61000;
      service.canExecute(key); // Enter HALF_OPEN

      // Fail again to reopen
      service.recordFailure(key);

      // Cycle 2: Wait again for recovery
      currentTime += 61000;
      service.canExecute(key);

      expect(service.getMetrics(key).state).toBe(CircuitBreakerState.HALF_OPEN);
    });
  });
});
