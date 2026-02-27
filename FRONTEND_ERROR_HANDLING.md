# Frontend Error Handling Guide - Retry & Circuit Breaker

## Overview

The backend now implements automatic retry and circuit breaker patterns. The frontend needs to understand these mechanisms and handle responses appropriately.

## How Backend Error Handling Works

### 1. **Transparent Retries** (Frontend sees nothing)

When a request fails with a transient error (timeout, 5xx, etc.):

- Backend automatically retries up to 3 times with exponential backoff
- Frontend receives the final response after all retries are exhausted
- **Example**: Database timeout → Backend retries 3 times → Returns success or error to frontend

### 2. **Circuit Breaker** (Frontend sees 503)

When a service fails repeatedly:

```
5+ consecutive failures → Circuit OPENS
        ↓
New requests immediately return 503 ServiceUnavailableException
        ↓
After 60 seconds → Circuit enters HALF_OPEN state
        ↓
2 consecutive successes → Circuit CLOSES and resumes normal operation
```

**Frontend receives**: `503 Service Unavailable - "Service temporarily unavailable - circuit breaker is OPEN"`

### 3. **Alert-Specific Retries** (More resilient)

Alert endpoints get 5 retries instead of 3, because alerts are critical.

## Expected Response Patterns

### Success (200)

```javascript
// Frontend receives normally
{
  id: "alert-123",
  alertContext: "Server down",
  status: "New",
  ...
}
```

### Retryable Error (Already retried by backend, now failing permanently)

```javascript
// 500/502/503 after 3+ retries
{
  statusCode: 503,
  message: "Service temporarily unavailable - circuit breaker is OPEN"
}
```

### Client Error (Not retried, immediate failure)

```javascript
// 400/401/404/422 immediately
{
  statusCode: 400,
  message: "Bad Request - alertContext is required"
}
```

### Timeout (Shouldn't happen often due to 30s timeout)

```javascript
// Rare, but handled
AbortError: Request timeout
```

### Network Error (Not retried by backend)

```javascript
// Browser handles
TypeError: Network error / No internet connection
```

## Frontend Implementation Patterns

### Pattern 1: Basic Error Handling (Already implemented)

```typescript
try {
  const res = await fetch(url, { headers: { Authorization: ... } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || 'Failed to load alerts');
  }
  // Use data
} catch (err: any) {
  setError(err?.message || 'Error loading alerts');
}
```

**Status**: ✅ Works, but could be improved

**Issues**:

- Doesn't distinguish circuit breaker from other 5xx errors
- No distinction between transient and permanent errors
- Could show better user messaging

### Pattern 2: Enhanced Error Handling (Recommended)

```typescript
import { fetchWithErrorHandling, type ApiErrorResponse } from "@/services/api";

async function loadAlerts() {
  setLoading(true);

  const response = await fetchWithErrorHandling<Alert[]>("/alerts", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = response.error!;

    // Handle circuit breaker specifically
    if (error.isCircuitBreakerOpen) {
      setError(
        "Service is temporarily overloaded. Please wait a moment and try again.",
      );
      // Maybe show retry button with countdown
    }
    // Handle timeout
    else if (error.isTimeout) {
      setError("Request took too long. Your connection may be slow.");
    }
    // Handle network
    else if (error.isNetworkError) {
      setError("Network error. Please check your connection.");
    }
    // Other errors
    else {
      setError(error.message);
    }
  } else {
    setAlerts(response.data);
  }

  setLoading(false);
}
```

### Pattern 3: Smart Retry on Frontend (For specific operations)

```typescript
/**
 * Frontend-level retry for important operations
 * Use only when network error happens, not for 5xx (backend already retried)
 */
async function performActionWithRetry<T>(
  action: () => Promise<ApiResponse<T>>,
  maxAttempts: number = 2, // Only 2 attempts on frontend
): Promise<ApiResponse<T>> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await action();

    // Don't retry on success
    if (response.ok) return response;

    // Only retry network errors on frontend (backend already retried 5xx)
    if (response.error?.isNetworkError && i < maxAttempts - 1) {
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      continue;
    }

    // Don't retry server errors (backend already tried)
    return response;
  }

  throw new Error("Max retry attempts exceeded");
}

// Usage
const response = await performActionWithRetry(() =>
  fetchWithErrorHandling("/alerts", options),
);
```

## Error Messaging to Users

### Good Error Messages

```
✅ "Service is temporarily overloaded. Please try again in a moment."
✅ "Network error. Please check your internet connection."
✅ "This email is already registered. Please use a different email."
✅ "You are not authorized to perform this action."
```

### Bad Error Messages

```
❌ "Error"
❌ "500 Internal Server Error"
❌ "Circuit breaker is OPEN"
❌ "Exponential backoff timeout"
```

## Handling Specific Scenarios

### Scenario 1: User Creates an Alert (Transient)

```
User clicks "Create Alert"
  ↓
Frontend sends POST /alerts
  ↓
Backend tries 3 times (database was temporarily down)
  ↓
3rd attempt succeeds
  ↓
Frontend receives 201 Created with alert data
  ↓
UI updates: "Alert created successfully"
```

**Frontend code**: Normal success handling

### Scenario 2: Database Is Down (Circuit Breaker)

```
User clicks "Create Alert"
  ↓
Backend tries 3 times, all fail
  ↓
Circuit opens (5 total consecutive failures)
  ↓
Frontend receives 503 ServiceUnavailableException
  ↓
UI shows: "Service temporarily overloaded. Please wait and try again."
```

**Frontend code**:

```typescript
if (response.error?.isCircuitBreakerOpen) {
  setError("Service is experiencing high load. Please try again in a moment.");
  // Optional: Show retry button with countdown to 60 seconds
}
```

### Scenario 3: Invalid Input

```
User submits alert with empty context
  ↓
Validation rejects immediately (no retries)
  ↓
Frontend receives 400 Bad Request
  ↓
UI shows: "Alert context is required"
```

**Frontend code**: Normal error handling

### Scenario 4: User Not Authorized

```
User with 'viewer' role tries to create alert
  ↓
Authorization check fails immediately
  ↓
Frontend receives 403 Forbidden
  ↓
UI shows: "You don't have permission to create alerts"
```

**Frontend code**: Normal error handling

## Debugging

### Enable Debug Logging

```typescript
// Add to services/api.ts during development
const DEBUG = process.env.NODE_ENV === "development";

export async function fetchWithErrorHandling<T = any>(
  url: string | URL,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  if (DEBUG) console.log("[API] Request:", url);

  try {
    const response = await fetch(url, {
      ...options,
      signal: createTimeoutSignal(30000),
    });
    if (DEBUG)
      console.log("[API] Response:", response.status, response.statusText);
    // ...
  } catch (err) {
    if (DEBUG) console.error("[API] Error:", err);
    // ...
  }
}
```

### Common Issues & Solutions

| Issue                                      | Cause                         | Solution                                                            |
| ------------------------------------------ | ----------------------------- | ------------------------------------------------------------------- |
| "Service unavailable" appears frequently   | Circuit breaker keeps opening | Check backend service health. View server logs for actual failures. |
| All alert operations fail with 503         | Database is down              | Restart database container: `docker-compose restart postgres`       |
| Alerts take 30+ seconds to create          | Multiple retries happening    | Normal during high load. Should resolve when circuit recovers.      |
| "Network error" shows but internet is fine | CORS or proxy issue           | Check browser console for CORS errors. Verify API URL is correct.   |

## Testing Circuit Breaker Locally

```bash
# Simulate database failure
docker-compose down postgres

# Try to create an alert
# - 1st-3rd requests: Take ~3 seconds (retrying)
# - 4th-5th requests: Fail immediately with 503
# - After 60 seconds: Attempts to recover in HALF_OPEN state

# Restart database
docker-compose up -d postgres

# Circuit should recover after 60 seconds + 2 successful requests
```

## Best Practices

1. **Show progress/loading during retries**

   ```typescript
   // Good: User knows something is happening
   <button disabled={loading}>{loading ? 'Loading...' : 'Create Alert'}</button>
   ```

2. **Distinguish error types for users**

   ```typescript
   if (error.isCircuitBreakerOpen) {
     // "Service overloaded, please wait"
   } else if (error.isNetworkError) {
     // "Check your internet connection"
   } else if (error.statusCode === 403) {
     // "You don't have permission"
   }
   ```

3. **Provide retry options for transient errors**

   ```typescript
   if (error.isNetworkError || error.isCircuitBreakerOpen) {
     // Show "Retry" button
   }
   ```

4. **Log errors for debugging**

   ```typescript
   console.error("[ALERT_API]", {
     url,
     status: response.status,
     error: response.error,
     timestamp: new Date().toISOString(),
   });
   ```

5. **Cache where possible**
   ```typescript
   // If circuit is open and we have recent cached data, show it
   if (error.isCircuitBreakerOpen && cachedAlerts) {
     setAlerts(cachedAlerts);
     setMessage("Showing cached data. Please try again in a moment.");
   }
   ```
