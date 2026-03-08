# Retry and Circuit Breaker Implementation Guide

## Overview

This document explains the retry and circuit breaker patterns implemented for all API endpoints in the backend-api service.

## Components

### 1. **CircuitBreakerService** (`src/interceptors/circuit-breaker.service.ts`)

Implements the circuit breaker pattern with three states:

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Service is failing, requests are rejected immediately
- **HALF_OPEN**: Testing if the service has recovered

**Key Features:**

- Tracks failures and successes per endpoint
- Automatically transitions between states
- Logs state transitions for debugging
- Provides metrics for monitoring

**Configuration:**

- `failureThreshold`: 5 failures before opening circuit
- `successThreshold`: 2 successes in half-open state before closing
- `timeout`: 60 seconds before attempting recovery from open state

### 2. **RetryInterceptor** (`src/interceptors/retry.interceptor.ts`)

Global interceptor applied to all API endpoints with exponential backoff retry strategy.

**Key Features:**

- Exponential backoff with jitter to prevent thundering herd
- Only retries on transient errors (timeouts, 5xx, 429, 408)
- Circuit breaker integration to prevent cascading failures
- Configurable max retries (default: 3)
- Automatic timeout handling (default: 30 seconds)

**Retry Logic:**

```
Attempt 1: 0 seconds (immediate)
Attempt 2: ~100-200ms (exponential backoff + jitter)
Attempt 3: ~200-400ms
Attempt 4: ~400-800ms (max 3 retries, so this won't happen by default)
```

### 3. **AlertRetryInterceptor** (`src/interceptors/alert-retry.interceptor.ts`)

Specialized interceptor for alert operations with more aggressive retry strategy.

**Key Features:**

- Higher max retries (5 vs 3 for global)
- Shorter delays for faster alert processing
- Alert-specific error detection
- Maintains separate circuit breaker state for alerts

**Why separate interceptor?**
Alerts are critical for system monitoring. They need faster retries and more resilience than general API calls.

## Request Flow

```
Incoming Request
    ↓
Circuit Breaker Check (can execute?)
    ↓
    NO → Return ServiceUnavailableException
    ↓
    YES → Execute Request
         ↓
         Success → Record success, return response
         ↓
         Error → Check if retryable
         ├─ YES → Wait (exponential backoff + jitter)
         │       ↓
         │     Retry limit reached?
         │     ├─ NO → Retry
         │     └─ YES → Record failure, throw error
         └─ NO → Record failure, throw error immediately
```

## Error Classification

### Retryable Errors (Will be retried)

- **408**: Request Timeout
- **429**: Too Many Requests
- **500**: Internal Server Error
- **502**: Bad Gateway
- **503**: Service Unavailable
- **504**: Gateway Timeout
- **TimeoutError**: Any timeout
- **Connection Errors**: ECONNREFUSED, ECONNRESET, ETIMEDOUT, etc.

### Non-Retryable Errors (Immediate failure)

- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not Found
- **422**: Unprocessable Entity
- Any validation or business logic errors

## Configuration

All configuration is centralized in `src/config/retry-circuit-breaker.config.ts`. You can modify:

```typescript
RETRY_CONFIG.global.maxRetries = 5; // Increase attempts
RETRY_CONFIG.alerts.maxDelay = 10000; // Increase max delay for alerts
CIRCUIT_BREAKER_CONFIG.default.failureThreshold = 3; // More sensitive to failures
```

## Monitoring and Debugging

### Logs

The system logs:

- **Retry attempts**: `[Retry] Attempt X for {endpoint}, delay: {ms}ms`
- **Circuit breaker transitions**: `[CircuitBreaker] {key} transitioned to {STATE}`
- **Failures**: `[RetryInterceptor] Request failed: {endpoint}`

Example log output:

```
[Retry] Attempt 1 for GET:/alerts, delay: 145ms
[Retry] Attempt 2 for GET:/alerts, delay: 298ms
[CircuitBreaker] GET:/alerts transitioned to OPEN
[RetryInterceptor] Request failed: GET:/alerts
```

### Metrics API (Optional)

You can expose circuit breaker metrics by adding these endpoints:

```typescript
@Get('_internal/health/circuit-breaker/:key')
getCircuitBreakerStatus(@Param('key') key: string) {
  return this.circuitBreakerService.getMetrics(key);
  // Returns: { state, failures, successes, lastFailure }
}
```

## Best Practices

1. **Don't retry idempotency-unsafe operations**: The current implementation only retries on specific HTTP status codes. Ensure your endpoints are idempotent or mark non-idempotent operations appropriately.

2. **Monitor circuit breaker states**: Regularly check logs for circuit breaker transitions. OPEN states indicate downstream service issues.

3. **Adjust timeouts for slow operations**: If you have operations that take longer than 30 seconds, increase the timeout in the configuration.

4. **Test failure scenarios**: Regularly test how your system behaves when services fail:

   ```bash
   # Simulate database failure
   docker-compose down postgres
   # Observe retry behavior and circuit breaker state transitions
   ```

5. **Alert on circuit breaker OPEN states**: Configure monitoring to alert when circuits are OPEN for extended periods.

## Testing

### Unit Tests

Example test for retry logic:

```typescript
it("should retry on timeout", (done) => {
  // Mock service that times out first, then succeeds
  vi
    .spyOn(httpService, "get")
    .mockImplementationOnce(() => throwError(() => new TimeoutError()))
    .mockImplementationOnce(() => of({ data: "success" }));

  service.someRequest().subscribe(
    (result) => {
      expect(result.data).toBe("success");
      done();
    },
    () => done.fail(),
  );
});
```

### Integration Tests

Test the complete flow:

```typescript
it("should reject requests when circuit is open", async () => {
  // Make 5+ failing requests to open the circuit
  for (let i = 0; i < 6; i++) {
    await request(app.getHttpServer()).get("/alerts").expect(503);
  }

  // Next request should be rejected immediately
  await request(app.getHttpServer())
    .get("/alerts")
    .expect(503)
    .expect((res) => {
      expect(res.body.message).toContain("circuit breaker is OPEN");
    });
});
```

## Troubleshooting

### Circuit breaker stays OPEN

**Symptom**: All requests to an endpoint return 503 ServiceUnavailableException

**Causes**:

1. Downstream service is down (database, external API, etc.)
2. Network connectivity issues
3. Timeout is too short

**Solutions**:

1. Check downstream service health
2. Verify network connectivity
3. Review logs for actual error messages
4. Increase timeout if operations are legitimately slow
5. Wait 60 seconds for automatic recovery attempt (HALF_OPEN state)

### Retries not happening

**Symptom**: Errors are returning immediately without retries

**Causes**:

1. Error is non-retryable (4xx client error)
2. Circuit breaker is OPEN
3. Retry count is 0

**Solutions**:

1. Check error status code - is it in the retryable list?
2. Check circuit breaker state in logs
3. Verify retry configuration

## Performance Considerations

- **Exponential backoff prevents overwhelming downed services** - each retry happens exponentially slower
- **Jitter prevents thundering herd** - retry times are randomized to prevent simultaneous retries
- **Circuit breaker prevents cascading failures** - a failing service won't consume resources indefinitely
- **Timeout prevents hanging requests** - requests won't hang indefinitely waiting for slow responses

## Future Enhancements

1. **Adaptive timeouts**: Automatically adjust timeouts based on response time percentiles
2. **Bulk-head pattern**: Isolate thread pools per endpoint to prevent resource exhaustion
3. **Advanced metrics**: Track retry success rates, circuit breaker state durations
4. **Distributed tracing**: Track requests across multiple services to identify failure points
5. **Fallback strategies**: Implement fallback values or cached responses when services fail
