# Frontend Response Handling - Quick Reference

## The Response Flow

```
Frontend                Backend                Database
   |                      |                        |
   |--GET /alerts-------->|                        |
   |                      |--try 1---------------->|
   |                      |<--(timeout)------------|
   |                      |--try 2---------------->|
   |                      |<--(timeout)------------|
   |                      |--try 3---------------->|
   |                      |<--200 OK & data--------|
   |<--200 OK & data------|
   |                      |
   |                      ✅ SUCCESS
```

With circuit breaker when service is down:

```
Frontend                Backend              Database
   |                      |                     |
   |--GET /alerts-------->|                     |
   |                      |--try 1--fails------>|
   |                      |--try 2--fails------>|
   |                      |--try 3--fails------>|
   |                      |                     |
   |                      Circuit status: 5/5 failures = OPEN
   |                      |
   |--GET /alerts-------->|
   |<--503 ("circuit is OPEN")
   |
   |                 (Wait 60 seconds)
   |
   |--GET /alerts-------->|
   |                      |--try--succeeds-------->|
   |<--200 OK & data------|
   |
   |                      ✅ RECOVERED
```

## Response Types Frontend Receives

### 1️⃣ Success (200)

```typescript
// No retries were needed, or retries succeeded
{
  ok: true,
  status: 200,
  data: {
    id: "alert-123",
    alertContext: "Server down",
    status: "New"
    // ... alert data
  }
}
```

### 2️⃣ Circuit Breaker Open (503)

```typescript
// Backend retried 3x, then circuit opened
{
  ok: false,
  status: 503,
  error: {
    message: "Service temporarily unavailable - circuit breaker is OPEN",
    statusCode: 503,
    isCircuitBreakerOpen: true,  // ← KEY FIELD
    isTimeout: false,
    isNetworkError: false,
    isRetryable: false
  }
}
```

### 3️⃣ Timeout (0)

```typescript
// Request took >30 seconds
{
  ok: false,
  status: 0,
  error: {
    message: "Request took too long to complete...",
    statusCode: 0,
    isCircuitBreakerOpen: false,
    isTimeout: true,  // ← KEY FIELD
    isNetworkError: false,
    isRetryable: true
  }
}
```

### 4️⃣ Network Error (0)

```typescript
// No internet or CORS error
{
  ok: false,
  status: 0,
  error: {
    message: "Network error. Please check your internet connection...",
    statusCode: 0,
    isCircuitBreakerOpen: false,
    isTimeout: false,
    isNetworkError: true,  // ← KEY FIELD
    isRetryable: true
  }
}
```

### 5️⃣ Client Error (400/401/403/404)

```typescript
// Bad request, not authorized, forbidden, not found
// These are NOT retried by backend
{
  ok: false,
  status: 400,
  data: { message: "alertContext is required" },
  error: {
    message: "alertContext is required",
    statusCode: 400,
    isCircuitBreakerOpen: false,
    isTimeout: false,
    isNetworkError: false,
    isRetryable: false
  }
}
```

## How to Handle Each Response Type

### For Circuit Breaker Open (503)

```typescript
if (error?.isCircuitBreakerOpen) {
  // ✅ Show user-friendly message
  setError("Service is temporarily overloaded. Please try again in a moment.");

  // ✅ Show "Try Again" button
  showRetryButton();

  // ✅ Optional: Show countdown (60 seconds for recovery)
  startCountdownTimer(60);

  // ✅ DON'T retry automatically - let circuit recover
  // ✅ DON'T retry more than once if user clicks retry
}
```

### For Timeout

```typescript
if (error?.isTimeout) {
  // ✅ Show message about slow connection
  setError(
    "This is taking longer than usual. Check your internet and try again.",
  );

  // ✅ Offer retry option (user has slow connection)
  showRetryButton();
}
```

### For Network Error

```typescript
if (error?.isNetworkError) {
  // ✅ Ask user to check internet
  setError("Network error. Please check your internet connection.");

  // ✅ Offer retry
  showRetryButton();
}
```

### For Client Error (400/401/403)

```typescript
if (response.status >= 400 && response.status < 500) {
  // ✅ Show error message as-is
  // ✅ DON'T show retry button (won't help)
  // ✅ Show helpful hint based on error

  if (response.status === 400) {
    setError("Invalid input. Please check your data.");
  } else if (response.status === 401) {
    setError("Session expired. Please log in again.");
  } else if (response.status === 403) {
    setError("You don't have permission to perform this action.");
  }
}
```

## Decision Tree

```
Is response OK? (status 2xx)
  ├─ YES → Use data, show success
  └─ NO → Check error type
      ├─ isCircuitBreakerOpen?
      │   └─ YES → Show "service overloaded" + "Try Again" button (no auto-retry)
      ├─ isTimeout?
      │   └─ YES → Show "taking too long" + "Try Again" button (1 retry OK)
      ├─ isNetworkError?
      │   └─ YES → Show "check internet" + "Try Again" button (1 retry OK)
      ├─ status 400-499?
      │   └─ YES → Show error message as-is (NO retry button)
      ├─ status 500-599?
      │   └─ YES → Show "server error" (backend already retried 3x, shouldn't reach here)
      └─ Other?
          └─ Show generic error message
```

## Code Template

```typescript
import { fetchWithErrorHandling } from "@/services/api";

async function myApiCall() {
  const response = await fetchWithErrorHandling("/alerts", options);

  if (response.ok) {
    // ✅ Success
    setAlerts(response.data);
    return;
  }

  // ❌ Error - check type
  const error = response.error!;

  if (error.isCircuitBreakerOpen) {
    setError("Service overloaded. Try again soon.");
    showRetryButton = true;
  } else if (error.isTimeout) {
    setError("Connection slow. Try again?");
    showRetryButton = true;
  } else if (error.isNetworkError) {
    setError("Network error. Check internet.");
    showRetryButton = true;
  } else if (response.status === 401) {
    redirectToLogin();
  } else {
    setError(error.message);
    showRetryButton = false;
  }
}
```

## Testing Different Scenarios

### Test 1: Successful Request (normal flow)

```bash
# Just make a normal request
# Result: Should see alert data in console
```

### Test 2: Circuit Breaker Opens

```bash
# Crash database
docker-compose down postgres

# Try to create 5+ alerts
# Result: first 3-5 get retried (takes time), then 503 "circuit breaker is OPEN"

# Restart database
docker-compose up postgres

# Wait 60 seconds
# Result: Circuit enters HALF_OPEN, next request succeeds and circuit closes
```

### Test 3: Timeout

```bash
# Make a slow request by adding artificial delay in backend
# Result: After 30 seconds, timeout error

# Frontend should handle gracefully
```

### Test 4: Network Error

```bash
# Disable internet/WiFi
# Try to make request
# Result: NetworkError, user should see "check your connection"

# Re-enable internet
# User clicks "Try Again"
# Result: Request succeeds
```

## Key Takeaways

| Frontend Sees | Backend Did                      | Frontend Should Do                                      |
| ------------- | -------------------------------- | ------------------------------------------------------- |
| 200 OK        | Succeeded (with/without retries) | Process data normally                                   |
| 503           | Retried 3x, circuit opened       | Show "service overloaded", offer retry button after 60s |
| Timeout       | Retried 3x, still too slow       | Show "taking too long", offer 1 retry                   |
| Network Error | Stopped (no network)             | Show "check internet", offer 1 retry                    |
| 400/401/403   | Didn't retry (client error)      | Show error message, no retry button                     |
| 500/502       | Retried 3x, still failing        | Same as circuit breaker (shouldn't happen often)        |

## Files Provided

1. **`src/services/api.ts`** - Drop-in fetch utility with error handling
2. **`components/AlertsList.example.tsx`** - Example of how to use the utility
3. **`FRONTEND_ERROR_HANDLING.md`** - Detailed guide with more patterns
4. **`RETRY_CIRCUIT_BREAKER.md`** (backend) - Backend implementation details

## Usage

### Quick Start

```typescript
import { fetchWithErrorHandling } from "@/services/api";

const response = await fetchWithErrorHandling("/alerts", {
  headers: { Authorization: `Bearer ${token}` },
});

if (response.ok) {
  // Use response.data
} else {
  // Handle response.error
}
```

### That's it! 🎉

The `fetchWithErrorHandling` utility handles:

- ✅ Timeouts (30 seconds)
- ✅ Circuit breaker detection (503 status)
- ✅ Network errors
- ✅ Proper error messages
- ✅ Type-safe responses
