# Running Tests - Quick Guide

## Run All Tests

### Backend

```bash
cd packages/backend-api
npm test
```

### Frontend

```bash
cd packages/frontend
npm test
```

### Both (from root)

```bash
npm test --workspaces
# or
lerna run test
```

## Run Specific Test Suites

### Backend - Circuit Breaker Tests

```bash
cd packages/backend-api
npm test circuit-breaker.service.spec
```

### Backend - Retry Interceptor Tests

```bash
cd packages/backend-api
npm test retry.interceptor.spec
```

### Backend - Alert Retry Tests

```bash
cd packages/backend-api
npm test alert-retry.interceptor.spec
```

### Frontend - API Utility Tests

```bash
cd packages/frontend
npm test api.test
```

### Frontend - useFetch Hook Tests

```bash
cd packages/frontend
npm test api.hook.test
```

### Frontend - AlertsList Component Tests

```bash
cd packages/frontend
npm test AlertsList.test
```

### Frontend - App Component Tests

```bash
cd packages/frontend
npm test App.test
```

## Watch Mode

Useful during development:

```bash
# Backend
cd packages/backend-api
npm test -- --watch

# Frontend
cd packages/frontend
npm test -- --watch
```

## Coverage Reports

### Backend Coverage

```bash
cd packages/backend-api
npm test -- --coverage
```

### Frontend Coverage

```bash
cd packages/frontend
npm test -- --coverage
```

Coverage reports will be generated in:

- `packages/backend-api/coverage/`
- `packages/frontend/coverage/`

Open `index.html` in each to view detailed coverage.

## Verbose Output

For detailed output:

```bash
npm test -- --verbose
```

## Debug Mode

```bash
# Backend
cd packages/backend-api
node --inspect-brk node_modules/.bin/jest --runInBand

# Frontend
cd packages/frontend
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome DevTools.

## Filter Tests by Pattern

Run only tests matching a pattern:

```bash
npm test -- --testNamePattern="Circuit Breaker"
npm test -- --testNamePattern="404"
npm test -- --testNamePattern="timeout"
```

## Test Structure

### Backend Test Files

- `src/interceptors/__tests__/circuit-breaker.service.spec.ts` - 15 tests
- `src/interceptors/__tests__/retry.interceptor.spec.ts` - 20 tests
- `src/interceptors/__tests__/alert-retry.interceptor.spec.ts` - 18 tests
- **Total: 53 tests**

### Frontend Test Files

- `src/services/api.test.ts` - 30 tests
- `src/services/api.hook.test.ts` - 11 tests
- `src/components/AlertsList.test.tsx` - 15 tests
- `src/App.test.tsx` - enhanced with error handling tests
- **Total: 56+ tests**

## Key Test Scenarios

### Backend

1. **Circuit Breaker States** - CLOSED → OPEN → HALF_OPEN → CLOSED
2. **Exponential Backoff** - 100ms → 5s with jitter
3. **Alert-Specific Retry** - 5 retries vs 3 global
4. **Error Classification** - Retryable vs non-retryable

### Frontend

1. **Error Detection** - Circuit breaker, timeout, network
2. **Error Display** - User-friendly messages
3. **Retry Logic** - Manual retry buttons
4. **State Management** - Loading, error, success states

## CI/CD Integration

Tests run automatically on:

- Pull requests
- Commits to main
- Pre-commit hooks (if configured)

## Troubleshooting

### Tests are slow

```bash
# Run tests in parallel
npm test -- --maxWorkers=4
```

### Tests are timing out

```bash
# Increase timeout
npm test -- --testTimeout=10000
```

### Can't find test file

```bash
# List all test files
npm test -- --listTests
```

### Mock issues

```bash
# Clear jest cache
npm test -- --clearCache

# Then rerun
npm test
```

## Expected Output

### Successful Run

```
PASS  src/interceptors/__tests__/circuit-breaker.service.spec.ts
  CircuitBreakerService
    ✓ should be defined (3 ms)
    ✓ should allow execution when circuit is CLOSED (2 ms)
    ✓ should reject execution when circuit is OPEN (2 ms)
    ...

Test Suites: 1 passed, 1 total
Tests: 15 passed, 15 total
Coverage: 95% statements, 90% branches
```

### Failed Run

```
FAIL  src/services/api.test.ts
  API Utility - fetchWithErrorHandling
    ✓ should return successful response
    ✗ should detect circuit breaker (Expected false, got true)

Tests: 1 failed, 29 passed, 30 total
```

## Common Commands

```bash
# Run everything
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run specific file
npm test -- api.test.ts

# Run matching pattern
npm test -- --testNamePattern="circuit"

# Run and exit (CI mode)
npm test -- --ci

# Generate coverage HTML report
npm test -- --coverage --coverageReporters=html
```

## Documentation

For detailed test documentation, see:

- [TEST_SUITE_DOCUMENTATION.md](../TEST_SUITE_DOCUMENTATION.md) - comprehensive guide
- [RETRY_CIRCUIT_BREAKER.md](../packages/backend-api/RETRY_CIRCUIT_BREAKER.md) - backend guide
- [FRONTEND_ERROR_HANDLING.md](../FRONTEND_ERROR_HANDLING.md) - frontend guide
- [FRONTEND_RESPONSE_HANDLING.md](../FRONTEND_RESPONSE_HANDLING.md) - response patterns

## Next Steps

1. **Run all tests**: `npm test --workspaces`
2. **Check coverage**: `npm test -- --coverage --workspaces`
3. **Review failures**: Fix any failing tests
4. **Integration tests**: Run e2e tests with real backend
5. **Deployment**: Confirm tests pass before merging to main

## Support

For issues with tests:

1. Check test output message
2. Review test file for context
3. Check mocks and setup
4. Clear cache: `npm test -- --clearCache`
5. Run in debug mode with DevTools
