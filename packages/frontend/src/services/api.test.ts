import { fetchWithErrorHandling, ApiResponse, ApiErrorResponse } from './api';

describe('API Utility - fetchWithErrorHandling', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('Success Responses', () => {
    it('should return successful response with data', async () => {
      const mockData = { id: 'alert-123', status: 'New' };
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce(mockData),
      });

      const response = await fetchWithErrorHandling('/alerts', {
        headers: { Authorization: 'Bearer token' },
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockData);
      expect(response.error).toBeUndefined();
    });

    it('should handle array responses', async () => {
      const mockData = [
        { id: 'alert-1', status: 'New' },
        { id: 'alert-2', status: 'Acknowledged' },
      ];
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce(mockData),
      });

      const response = await fetchWithErrorHandling('/alerts');

      expect(response.ok).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data?.length).toBe(2);
    });
  });

  describe('Circuit Breaker Detection', () => {
    it('should detect circuit breaker open (503) status', async () => {
      const mockError = {
        statusCode: 503,
        message: 'Service temporarily unavailable - circuit breaker is OPEN',
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce(mockError),
      });

      const response = await fetchWithErrorHandling('/alerts');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(503);
      expect(response.error?.isCircuitBreakerOpen).toBe(true);
      expect(response.error?.message).toContain('temporarily unavailable');
    });

    it('should flag circuit breaker error correctly', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({}),
      });

      const response = await fetchWithErrorHandling('/alerts');

      expect(response.error?.isCircuitBreakerOpen).toBe(true);
      expect(response.error?.isTimeout).toBe(false);
      expect(response.error?.isNetworkError).toBe(false);
      expect(response.error?.isRetryable).toBe(false);
    });
  });

  describe('Timeout Handling', () => {
    it('should handle abort timeout', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(
        new DOMException('AbortError', 'AbortError'),
      );

      const response = await fetchWithErrorHandling('/alerts');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(0);
      expect(response.error?.isTimeout).toBe(true);
      expect(response.error?.message).toContain('took too long');
    });

    it('should flag timeout fields correctly', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(
        new DOMException('AbortError', 'AbortError'),
      );

      const response = await fetchWithErrorHandling('/alerts');

      expect(response.error?.isTimeout).toBe(true);
      expect(response.error?.isNetworkError).toBe(false);
      expect(response.error?.isCircuitBreakerOpen).toBe(false);
      expect(response.error?.isRetryable).toBe(true);
    });
  });

  describe('Network Error Handling', () => {
    it('should detect network errors', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(
        new TypeError('Failed to fetch'),
      );

      const response = await fetchWithErrorHandling('/alerts');

      expect(response.ok).toBe(false);
      expect(response.error?.isNetworkError).toBe(true);
      expect(response.error?.message).toContain('Network error');
    });

    it('should flag network error fields correctly', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(
        new TypeError('Failed to fetch'),
      );

      const response = await fetchWithErrorHandling('/alerts');

      expect(response.error?.isNetworkError).toBe(true);
      expect(response.error?.isTimeout).toBe(false);
      expect(response.error?.isCircuitBreakerOpen).toBe(false);
      expect(response.error?.isRetryable).toBe(true);
    });

    it('should handle offline status', async () => {
      // Mock navigator.onLine as false
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        value: false,
      });

      global.fetch = jest.fn().mockRejectedValueOnce(
        new TypeError('Network request failed'),
      );

      const response = await fetchWithErrorHandling('/alerts');

      expect(response.error?.isNetworkError).toBe(true);

      // Restore
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        value: true,
      });
    });
  });

  describe('Client Error Handling (4xx)', () => {
    it('should handle 400 Bad Request', async () => {
      // When server provides a message, that message is used
      const errorData = { message: 'alertContext is required' };
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce(errorData),
      });

      const response = await fetchWithErrorHandling('/alerts', {
        method: 'POST',
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(response.error?.message).toContain('alertContext is required');
      expect(response.error?.isRetryable).toBe(false);
    });

    it('should handle 401 Unauthorized', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({ message: 'Unauthorized' }),
      });

      const response = await fetchWithErrorHandling('/protected');

      expect(response.status).toBe(401);
      expect(response.error?.message).toContain('Unauthorized');
      expect(response.error?.isRetryable).toBe(false);
    });

    it('should handle 403 Forbidden', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({ message: 'Forbidden' }),
      });

      const response = await fetchWithErrorHandling('/admin');

      expect(response.status).toBe(403);
      expect(response.error?.message).toContain('Forbidden');
      expect(response.error?.isRetryable).toBe(false);
    });

    it('should handle 404 Not Found', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({ message: 'Not found' }),
      });

      const response = await fetchWithErrorHandling('/alerts/notfound');

      expect(response.status).toBe(404);
      expect(response.error?.isRetryable).toBe(false);
    });
  });

  describe('Server Error Handling (5xx)', () => {
    it('should handle 500 Internal Server Error', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({ message: 'Server error' }),
      });

      const response = await fetchWithErrorHandling('/alerts');

      expect(response.status).toBe(500);
      expect(response.error?.statusCode).toBe(500);
    });

    it('should handle 502 Bad Gateway', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 502,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({ message: 'Bad gateway' }),
      });

      const response = await fetchWithErrorHandling('/alerts');

      expect(response.status).toBe(502);
    });

    it('should handle 504 Gateway Timeout', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 504,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({ message: 'Gateway timeout' }),
      });

      const response = await fetchWithErrorHandling('/alerts');

      expect(response.status).toBe(504);
    });
  });

  describe('Response Parsing', () => {
    it('should parse JSON response', async () => {
      const mockData = { id: '123', name: 'Test' };
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce(mockData),
      });

      const response = await fetchWithErrorHandling('/test');

      expect(response.data).toEqual(mockData);
    });

    it('should handle text response', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: jest.fn().mockResolvedValueOnce('Success'),
      });

      const response = await fetchWithErrorHandling('/test');

      expect(response.data).toBe('Success');
    });

    it('should handle malformed JSON gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockRejectedValueOnce(new SyntaxError('Invalid JSON')),
      });

      const response = await fetchWithErrorHandling('/test');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe('Error Message Formatting', () => {
    it('should provide user-friendly error messages', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({}),
      });

      const response = await fetchWithErrorHandling('/test');

      expect(response.error?.message).toBe(
        'Bad request. Please check your input and try again.',
      );
    });

    it('should use error message from response if available', async () => {
      const customMessage = 'Custom validation error';
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({ message: customMessage }),
      });

      const response = await fetchWithErrorHandling('/test');

      expect(response.error?.message).toBe(customMessage);
    });
  });

  describe('Request Options', () => {
    it('should pass through request options', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({ success: true }),
      });

      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' }),
      };

      await fetchWithErrorHandling('/test', options);

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should add abort timeout signal', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({}),
      });

      await fetchWithErrorHandling('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  describe('Type Safety', () => {
    it('should maintain type information', async () => {
      interface AlertResponse {
        id: string;
        status: string;
      }

      const mockData: AlertResponse = { id: 'alert-123', status: 'New' };
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce(mockData),
      });

      const response = await fetchWithErrorHandling<AlertResponse>('/alerts/123');

      expect(response.ok).toBe(true);
      if (response.ok) {
        expect(response.data?.id).toBe('alert-123');
        expect(response.data?.status).toBe('New');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing Content-Type header', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: jest.fn().mockResolvedValueOnce({ data: 'test' }),
      });

      const response = await fetchWithErrorHandling('/test');

      expect(response.ok).toBe(true);
    });

    it('should handle empty response body', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
        json: jest.fn().mockResolvedValueOnce(null),
      });

      const response = await fetchWithErrorHandling('/test');

      expect(response.ok).toBe(true);
    });

    it('should handle unknown errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Unknown error'));

      const response = await fetchWithErrorHandling('/test');

      expect(response.ok).toBe(false);
      // The error message from the thrown Error is preserved
      expect(response.error?.message).toContain('Unknown error');
    });
  });
});
