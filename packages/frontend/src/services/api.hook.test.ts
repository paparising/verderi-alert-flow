import { renderHook, act, waitFor } from '@testing-library/react';
import { useFetch, fetchWithErrorHandling } from './api';

describe('useFetch Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useFetch('/alerts'));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should load data successfully', async () => {
    const mockData = [{ id: 'alert-1', status: 'New' }];
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: jest.fn().mockResolvedValueOnce(mockData),
    });

    const { result } = renderHook(() => useFetch('/alerts'));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('should handle error state', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: jest.fn().mockResolvedValueOnce({
        message: 'Service unavailable',
      }),
    });

    const { result } = renderHook(() => useFetch('/alerts'));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.statusCode).toBe(503);
  });

  it('should support manual fetch calls', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: jest.fn().mockResolvedValueOnce({ id: 'alert-123' }),
    });

    const { result } = renderHook(() => useFetch<any>(null));

    await act(async () => {
      await result.current.fetch('/alerts/123');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.id).toBe('alert-123');
  });

  it('should update loading state during fetch', async () => {
    let resolvePromise: (value: any) => void;
    global.fetch = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
    );

    const { result } = renderHook(() => useFetch('/test'));

    // Start the refetch
    let refetchPromise: Promise<void>;
    await act(async () => {
      refetchPromise = result.current.refetch();
    });

    // Loading should be true now
    expect(result.current.loading).toBe(true);

    // Resolve the fetch
    await act(async () => {
      resolvePromise!({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({ data: 'test' }),
      });
      await refetchPromise!;
    });

    expect(result.current.loading).toBe(false);
  });

  it('should distinguish circuit breaker errors', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: jest.fn().mockResolvedValueOnce({}),
    });

    const { result } = renderHook(() => useFetch<any>('/alerts'));

    // Wait for initial render
    expect(result.current).not.toBeNull();

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.isCircuitBreakerOpen).toBe(true);
  });

  it('should distinguish timeout errors', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(
      new DOMException('AbortError', 'AbortError'),
    );

    const { result } = renderHook(() => useFetch<any>('/alerts'));

    // Wait for initial render
    expect(result.current).not.toBeNull();

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.isTimeout).toBe(true);
  });

  it('should distinguish network errors', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(
      new TypeError('Failed to fetch'),
    );

    const { result } = renderHook(() => useFetch<any>('/alerts'));

    // Wait for initial render
    expect(result.current).not.toBeNull();

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.isNetworkError).toBe(true);
  });

  it('should clear error on successful fetch after error', async () => {
    // First call fails
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: jest.fn().mockResolvedValueOnce({}),
    });

    const { result } = renderHook(() => useFetch('/alerts'));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    // Second call succeeds
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: jest.fn().mockResolvedValueOnce([]),
    });

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual([]);
  });

  it('should support functional URLs', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: jest.fn().mockResolvedValueOnce({ data: 'test' }),
    });

    const { result } = renderHook(() =>
      useFetch(() => '/api/alerts'),
    );

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ data: 'test' });
  });
});
