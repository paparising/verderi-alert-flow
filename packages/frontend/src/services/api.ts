/**
 * Enhanced Fetch Utility with Error Handling
 * 
 * This utility wraps the native Fetch API and provides:
 * - Automatic error handling for circuit breaker (503) responses
 * - User-friendly error messages
 * - Proper handling of transient vs. permanent errors
 * - Type-safe responses
 */

export interface ApiErrorResponse {
  message: string;
  statusCode: number;
  isCircuitBreakerOpen: boolean;
  isTimeout: boolean;
  isNetworkError: boolean;
  isRetryable: boolean;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: ApiErrorResponse;
}

/**
 * Enhanced fetch with circuit breaker and error handling
 */
export async function fetchWithErrorHandling<T = any>(
  url: string | URL,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      // Add timeout
      signal: createTimeoutSignal(30000), // 30 seconds
    });

    const data = await parseResponse<T>(response);

    if (!response.ok) {
      // Handle circuit breaker open (503)
      if (response.status === 503) {
        return {
          ok: false,
          status: response.status,
          error: {
            message:
              'Service temporarily unavailable. Too many failures occurred. Please try again in a moment.',
            statusCode: 503,
            isCircuitBreakerOpen: true,
            isTimeout: false,
            isNetworkError: false,
            isRetryable: false, // Frontend shouldn't retry - backend circuit is open
          },
        };
      }

      // Handle other errors
      return {
        ok: false,
        status: response.status,
        data,
        error: {
          message: data?.message || getErrorMessage(response.status),
          statusCode: response.status,
          isCircuitBreakerOpen: false,
          isTimeout: false,
          isNetworkError: false,
          isRetryable: isRetryableStatus(response.status),
        },
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch (err: any) {
    // Handle timeout errors
    if (err.name === 'AbortError') {
      return {
        ok: false,
        status: 0,
        error: {
          message:
            'Request took too long to complete. The server may be experiencing high load. Please try again.',
          statusCode: 0,
          isCircuitBreakerOpen: false,
          isTimeout: true,
          isNetworkError: false,
          isRetryable: true,
        },
      };
    }

    // Handle network errors
    const isNetworkError = err.name === 'TypeError' || !navigator.onLine;
    if (isNetworkError) {
      return {
        ok: false,
        status: 0,
        error: {
          message:
            'Network error. Please check your internet connection and try again.',
          statusCode: 0,
          isCircuitBreakerOpen: false,
          isTimeout: false,
          isNetworkError: true,
          isRetryable: true,
        },
      };
    }

    // Unknown error
    return {
      ok: false,
      status: 0,
      error: {
        message: err?.message || 'An unexpected error occurred. Please try again.',
        statusCode: 0,
        isCircuitBreakerOpen: false,
        isTimeout: false,
        isNetworkError: false,
        isRetryable: false,
      },
    };
  }
}

/**
 * Create an AbortSignal that times out after specified milliseconds
 */
function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

/**
 * Parse response body safely
 */
async function parseResponse<T>(response: Response): Promise<T | any> {
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Determine if an HTTP status code is retryable by the frontend
 * Note: Backend already retries transient errors, so frontend should only retry on network/connection issues
 */
function isRetryableStatus(status: number): boolean {
  // Don't retry on success
  if (status >= 200 && status < 300) {
    return false;
  }

  // Don't retry on client errors (4xx) - they indicate bad input
  if (status >= 400 && status < 500) {
    return false;
  }

  // For 5xx, the backend should have already retried, so frontend shouldn't retry
  // Circuit breaker (503) is explicitly non-retryable on frontend
  return false;
}

/**
 * Get user-friendly error message based on status code
 */
function getErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Bad request. Please check your input and try again.';
    case 401:
      return 'Unauthorized. Please log in again.';
    case 403:
      return 'Forbidden. You do not have permission to access this resource.';
    case 404:
      return 'The requested resource was not found.';
    case 408:
      return 'Request timeout. Please try again.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'Server error. Please try again later.';
    case 502:
      return 'Bad gateway. Please try again later.';
    case 503:
      return 'Service unavailable. Please try again later.';
    case 504:
      return 'Gateway timeout. Please try again later.';
    default:
      return `Error (${status}). Please try again.`;
  }
}

/**
 * Hook for using the enhanced fetch in React components
 */
import { useState, useCallback } from 'react';

export interface UseFetchState<T> {
  data: T | null;
  loading: boolean;
  error: ApiErrorResponse | null;
}

export function useFetch<T = any>(
  url: string | null | (() => string | null),
): UseFetchState<T> & {
  refetch: () => Promise<void>;
  fetch: (
    endpoint: string,
    options?: RequestInit,
  ) => Promise<ApiResponse<T>>;
} {
  const [state, setState] = useState<UseFetchState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const refetch = useCallback(async () => {
    if (!url || (typeof url === 'function' && !url())) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const endpoint = typeof url === 'function' ? url() : url;
    if (!endpoint) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const response = await fetchWithErrorHandling<T>(endpoint);

    setState({
      data: response.data || null,
      loading: false,
      error: response.error || null,
    });
  }, [url]);

  const fetch = useCallback(
    async (endpoint: string, options?: RequestInit) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const response = await fetchWithErrorHandling<T>(endpoint, options);
      setState({
        data: response.data || null,
        loading: false,
        error: response.error || null,
      });
      return response;
    },
    [],
  );

  return {
    ...state,
    refetch,
    fetch,
  };
}
