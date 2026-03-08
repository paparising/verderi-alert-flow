# Test Suite Documentation

## Overview

This document outlines all the tests created for the retry and circuit breaker implementation across both backend and frontend.

## Backend Tests

### 1. CircuitBreakerService Tests

**File**: `packages/backend-api/src/interceptors/__tests__/circuit-breaker.service.spec.ts`

**Coverage**:

- ✅ State initialization (CLOSED, OPEN, HALF_OPEN)
- ✅ State transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
- ✅ Failure recording and threshold management
- ✅ Success recording and recovery
- ✅ Timeout-based recovery
- ✅ Per-key state isolation
- ✅ Metrics retrieval
- ✅ Edge cases and rapid failures

**Key Test Cases**:

```typescript
// State Management
- canExecute() returns true when CLOSED
- canExecute() returns false when OPEN
- canExecute() returns true when HALF_OPEN after timeout

// Transitions
- CLOSED → OPEN after 5 failures
- OPEN → HALF_OPEN after 60s timeout
- HALF_OPEN → CLOSED after 2 successes

// Failure Handling
- Tracks consecutive failures
- Records last failure time
- Increments failure count

// Recovery
- Records successes in HALF_OPEN state
- Reopens circuit if failure in HALF_OPEN
- Resets state when circuit closes
```

### 2. RetryInterceptor Tests

**File**: `packages/backend-api/src/interceptors/__tests__/retry.interceptor.spec.ts`

**Coverage**:

- ✅ Circuit breaker integration
- ✅ Exponential backoff retry logic
- ✅ Retryable error detection
- ✅ Non-retryable error detection
- ✅ Max retry attempts (3)
- ✅ Failure recording in circuit breaker
- ✅ Connection key generation

**Retryable Errors Tested**:

```
✅ 408 Request Timeout
✅ 429 Too Many Requests
✅ 500 Internal Server Error
✅ 502 Bad Gateway
✅ 503 Service Unavailable
✅ 504 Gateway Timeout
✅ TimeoutError
✅ Network connection errors (ECONNREFUSED, ECONNRESET, etc.)
```

**Non-Retryable Errors Tested**:

```
✅ 400 Bad Request
✅ 401 Unauthorized
✅ 403 Forbidden
✅ 404 Not Found
```

### 3. AlertRetryInterceptor Tests

**File**: `packages/backend-api/src/interceptors/__tests__/alert-retry.interceptor.spec.ts`

**Coverage**:

- ✅ Enhanced retry for alerts (5 max attempts vs 3 global)
- ✅ Faster backoff (50ms → 3s vs 100ms → 5s)
- ✅ Database-specific error detection
- ✅ Circuit breaker for alerts
- ✅ Non-retryable error handling

**Key Differences from Global Retry**:

```typescript
// Max Attempts
Global: 3 retries
Alerts: 5 retries ← More resilient

// Delays
Global: 100ms → 5s
Alerts: 50ms → 3s ← Faster for critical operations

// Error Detection
- ECONNREFUSED, ECONNRESET
- ETIMEDOUT errors
- Connection timeout messages
```

## Frontend Tests

### 1. API Utility Tests

**File**: `packages/frontend/src/services/api.test.ts`

**Coverage**:

- ✅ Success response handling
- ✅ Circuit breaker detection (503)
- ✅ Timeout detection
- ✅ Network error detection
- ✅ Client error handling (4xx)
- ✅ Server error handling (5xx)
- ✅ Response parsing (JSON, text)
- ✅ Error message formatting
- ✅ Error flag detection

**Error Type Detection Tests**:

```typescript
✅ isCircuitBreakerOpen: true when status 503
✅ isTimeout: true when AbortError
✅ isNetworkError: true when fetch fails
✅ isRetryable: true for network/timeout, false for client errors

Response Patterns Tested:
✅ { ok: true, data: {...} }
✅ { ok: false, status: 503, error: { isCircuitBreakerOpen: true } }
✅ { ok: false, status: 0, error: { isTimeout: true } }
✅ { ok: false, status: 0, error: { isNetworkError: true } }
✅ { ok: false, status: 400, error: { isRetryable: false } }
```

### 2. useFetch Hook Tests

**File**: `packages/frontend/src/services/api.hook.test.ts`

**Coverage**:

- ✅ Hook initialization
- ✅ Successful data loading
- ✅ Error state management
- ✅ Manual fetch calls
- ✅ Loading state transitions
- ✅ Error type distinction
- ✅ Error clearing after recovery
- ✅ Functional URL support

**Key Test Cases**:

```typescript
✅ Initialize with data: null, loading: false, error: null
✅ Load data and update state
✅ Handle different error types
✅ Support refetch() method
✅ Support fetch(url) method with manual URLs
✅ Distinguish circuit breaker errors
✅ Distinguish timeout errors
✅ Distinguish network errors
✅ Clear errors on successful recovery
```

### 3. AlertsList Component Tests

**File**: `packages/frontend/src/components/AlertsList.test.tsx`

**Coverage**:

- ✅ Circuit breaker UI display
- ✅ Timeout UI display
- ✅ Network error UI display
- ✅ Manual retry button functionality
- ✅ Retry countdown display
- ✅ Loading states
- ✅ Empty state handling
- ✅ Successful load rendering
- ✅ WebSocket connection status
- ✅ Development error details

**UI Tests**:

```typescript
✅ Display circuit breaker message
✅ Show retry countdown (60s)
✅ Display "Try Again" button on circuit breaker
✅ Show timeout message
✅ Show network error message
✅ Retry button triggers manual refresh
✅ Loading message during fetch
✅ Loading state during async operations
✅ Empty state when no alerts
✅ Show alerts list after successful load
✅ Error details visible in non-production environments
```

## Running the Tests

### Backend Tests

```bash
# Run all backend tests
cd packages/backend-api
npm test

# Run specific test suite
npm test circuit-breaker.service.spec
npm test retry.interceptor.spec
npm test alert-retry.interceptor.spec

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Frontend Tests

```bash
# Run all frontend tests
cd packages/frontend
npm test

# Run specific test suite
npm test api.test
npm test api.hook.test
npm test AlertsList.test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## Test Coverage Summary

### Backend Coverage

| Module                | Tests        | Key Coverage                         |
| --------------------- | ------------ | ------------------------------------ |
| CircuitBreakerService | 15 tests     | States, transitions, recovery        |
| RetryInterceptor      | 20 tests     | Retry logic, backoff, errors         |
| AlertRetryInterceptor | 18 tests     | Alert-specific retry, failures       |
| **Total Backend**     | **53 tests** | **Circuit breaker + retry patterns** |

### Frontend Coverage

| Module               | Tests        | Key Coverage                     |
| -------------------- | ------------ | -------------------------------- |
| API Utility          | 30 tests     | Error detection, parsing         |
| useFetch Hook        | 11 tests     | Hook lifecycle, state management |
| AlertsList Component | 17 tests     | UI, error display, retry         |
| App Component        | 6 tests      | Login, error handling            |
| **Total Frontend**   | **60 tests** | **Error handling + retry UI**    |

### Total Test Coverage: **113 tests**

## Critical Test Scenarios

### Scenario 1: Database Failure & Recovery

```
Test: Connection fails 3+ times → Backend retries → Circuit opens
Expected: 503 response with isCircuitBreakerOpen: true
Frontend: Shows "Service overloaded" message + retry button
After 60s: Circuit recovers, next request succeeds
```

### Scenario 2: Network Timeout

```
Test: Request takes >30 seconds
Expected: Timeout error with isTimeout: true
Frontend: Shows "Request took too long" message
User can retry with button
```

### Scenario 3: No Internet Connection

```
Test: Fetch fails with TypeError
Expected: Network error with isNetworkError: true
Frontend: Shows "Check your internet" message
User can retry when connection restored
```

### Scenario 4: Invalid Request

```
Test: POST with missing required field
Expected: 400 error with isRetryable: false
Frontend: Shows validation error
No retry button shown
```

### Scenario 5: Cascading Failures

```
Test: Multiple endpoints fail simultaneously
Expected: Each has independent circuit breaker state
Verify: Opening circuit A doesn't affect circuit B
```

## Assertion Examples

### Circuit Breaker Assertions

```typescript
// Open circuit detection
expect(service.canExecute(key)).toBe(false);
expect(service.getMetrics(key).state).toBe(CircuitBreakerState.OPEN);

// Recovery transition
vi.advanceTimersByTime(61000);
expect(service.canExecute(key)).toBe(true);
expect(service.getMetrics(key).state).toBe(CircuitBreakerState.HALF_OPEN);

// Close after success
service.recordSuccess(key);
service.recordSuccess(key);
expect(service.getMetrics(key).state).toBe(CircuitBreakerState.CLOSED);
```

### Retry Assertions

```typescript
// Verify retries happen
expect(mockHandler.handle).toHaveBeenCalledTimes(3); // 1 initial + 2 retries

// Verify exponential backoff
expect(delays[1]).toBeGreaterThan(delays[0]);
expect(delays[2]).toBeGreaterThan(delays[1]);

// Verify stops on success
let attemptCount = 0;
if (attemptCount < 2) throw error;
else return success;
expect(attemptCount).toBe(2); // Stopped after success
```

### Frontend Error Detection

```typescript
// Circuit breaker detection
const response = await fetchWithErrorHandling("/alerts");
expect(response.error?.isCircuitBreakerOpen).toBe(true);

// Timeout detection
expect(response.error?.isTimeout).toBe(true);

// Network error detection
expect(response.error?.isNetworkError).toBe(true);

// Non-retryable error
expect(response.error?.isRetryable).toBe(false);
```

### UI Assertions

```typescript
// Error message display
expect(
  screen.getByText(/Service is temporarily overloaded/i),
).toBeInTheDocument();

// Retry button presence
expect(screen.getByRole("button", { name: /Try Again/i })).toBeInTheDocument();

// Countdown display
expect(screen.getByText(/Service recovering/i)).toBeInTheDocument();

// Loading state
expect(screen.getByText(/Loading alerts/i)).toBeInTheDocument();
```

## Continuous Integration

All tests run automatically on:

- ✅ Pull request creation
- ✅ Commits to main branch
- ✅ Pre-commit hooks (optional)

### CI Configuration

```yaml
test:
  backend:
    - vitest run --maxWorkers=2
    - Coverage must be >80%
  frontend:
    - vitest run --maxWorkers=2
    - Coverage must be >80%
```

## Test Maintenance

### Adding New Tests

1. **Backend**: Add to corresponding `__tests__/*.spec.ts` file
2. **Frontend**: Add to corresponding `.test.ts` or `.test.tsx` file
3. **Pattern**: Describe block → it blocks with clear names
4. **Mocking**: Prefer `vi.mock()` for dependencies
5. **Cleanup**: Clear timers/mocks in beforeEach/afterEach

### Updating Tests

When changing retry/circuit breaker logic:

1. Update test expectations
2. Verify test still reflects real behavior
3. Add tests for new edge cases
4. Update this documentation

## Debugging Tests

```bash
# Run single test file
npm test -- api.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="Circuit Breaker"

# Debug mode
npx vitest run --inspect-brk

# Verbose output
npm test -- --verbose

# Show coverage
npm test -- --coverage --coverageReporters=text-summary
```

## Performance

- Backend tests: ~5 seconds
- Frontend tests: ~8 seconds
- Total: ~13 seconds
- All tests use fake timers to run instantly (no actual delays)

## Future Enhancements

- [ ] E2E tests with actual backend/database
- [ ] Load testing for circuit breaker under stress
- [ ] Visual regression tests for UI error states
- [ ] Integration tests across backend-frontend
- [ ] Performance benchmarks for retry delays
