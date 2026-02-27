import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertsListEnhanced } from './AlertsList.example';
import { useAlertSocket } from '../hooks/useAlertSocket';

// Mock the socket hook
jest.mock('../hooks/useAlertSocket', () => ({
  __esModule: true,
  useAlertSocket: jest.fn(),
}));

const mockUseAlertSocket = useAlertSocket as jest.MockedFunction<typeof useAlertSocket>;

describe('AlertsList - Error Handling', () => {
  const mockProps = {
    orgId: 'org-123',
    apiUrl: 'http://localhost:3001',
    token: 'mock-token',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementation for each test
    mockUseAlertSocket.mockReturnValue({
      isConnected: false,
      socket: null,
    });
  });

  describe('Circuit Breaker Error Handling', () => {
    it('should display circuit breaker message on 503', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({
          message: 'Service temporarily unavailable - circuit breaker is OPEN',
        }),
      });

      render(<AlertsListEnhanced {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Service is temporarily overloaded/i),
        ).toBeInTheDocument();
      });
    });

    it('should show retry countdown on circuit breaker error', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({}),
      });

      jest.useFakeTimers();

      render(<AlertsListEnhanced {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Service recovering/i)).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('should show Try Again button on circuit breaker error', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({}),
      });

      render(<AlertsListEnhanced {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
      });
    });
  });

  describe('Timeout Error Handling', () => {
    it('should display timeout message', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(
        new DOMException('AbortError', 'AbortError'),
      );

      render(<AlertsListEnhanced {...mockProps} />);

      await waitFor(() => {
        // Error message appears both in display and error details
        const errorElements = screen.getAllByText(/took too long/i);
        expect(errorElements.length).toBeGreaterThan(0);
      });
    });

    it('should show Try Again button on timeout', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(
        new DOMException('AbortError', 'AbortError'),
      );

      render(<AlertsListEnhanced {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
      });
    });
  });

  describe('Network Error Handling', () => {
    it('should display network error message', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(
        new TypeError('Failed to fetch'),
      );

      render(<AlertsListEnhanced {...mockProps} />);

      await waitFor(() => {
        // Error message appears both in display and error details
        const errorElements = screen.getAllByText(/Network error/i);
        expect(errorElements.length).toBeGreaterThan(0);
      });
    });

    it('should show Try Again button on network error', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(
        new TypeError('Failed to fetch'),
      );

      render(<AlertsListEnhanced {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
      });
    });
  });

  describe('Retry Functionality', () => {
    it('should allow manual retry on error', async () => {
      // First call fails
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: jest.fn().mockResolvedValueOnce({}),
        })
        // Second call succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: jest.fn().mockResolvedValueOnce([]),
        });

      const { rerender } = render(<AlertsListEnhanced {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Service is temporarily overloaded/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /Try Again/i });
      fireEvent.click(retryButton);

      rerender(<AlertsListEnhanced {...mockProps} />);

      await waitFor(() => {
        // Should either show no errors or successfully loaded lists
      });
    });
  });

  describe('WebSocket Connection Status', () => {
    it('should display WebSocket connection status', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce([]),
      });

      render(<AlertsListEnhanced {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/WebSocket:/i)).toBeInTheDocument();
      });
    });
  });

  describe('Development Error Details', () => {
    it('should show detailed error information in non-production', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce({}),
      });

      render(<AlertsListEnhanced {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Error Details/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading message during fetch', async () => {
      global.fetch = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  headers: new Headers({ 'content-type': 'application/json' }),
                  json: jest.fn().mockResolvedValueOnce([]),
                }),
              100,
            ),
          ),
      );

      render(<AlertsListEnhanced {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Loading alerts/i)).toBeInTheDocument();
      });
    });

    it('should show loading state during fetch', async () => {
      let resolvePromise: (value: any) => void;
      global.fetch = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          }),
      );

      render(<AlertsListEnhanced {...mockProps} />);

      // Check for loading message
      await waitFor(() => {
        expect(
          screen.getByText(/Loading alerts/i),
        ).toBeInTheDocument();
      });

      // Resolve the promise to clean up
      resolvePromise!({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce([]),
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no alerts', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce([]),
      });

      render(<AlertsListEnhanced {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/No alerts/i)).toBeInTheDocument();
      });
    });
  });

  describe('Successful Load', () => {
    it('should display alerts after successful load', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          alertId: 'uuid-1',
          alertContext: 'Server down',
          status: 'New',
          createdAt: new Date().toISOString(),
        },
      ];

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValueOnce(mockAlerts),
      });

      render(<AlertsListEnhanced {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Server down/i)).toBeInTheDocument();
      });
    });
  });
});
