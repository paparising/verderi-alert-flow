import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertForm } from './AlertForm';

describe('AlertForm', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders form with all fields', () => {
      render(<AlertForm token={mockToken} />);

      expect(screen.getByText(/POST New Alerts/i)).toBeInTheDocument();
      expect(screen.getByText(/Alert Message/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create alert/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
    });

    test('renders textarea for alert context', () => {
      render(<AlertForm token={mockToken} />);

      const textarea = screen.getByPlaceholderText(/CPU > 90%/i);
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    test('allows typing in alert context', () => {
      render(<AlertForm token={mockToken} />);

      const textarea = screen.getByPlaceholderText(/CPU > 90%/i);
      fireEvent.change(textarea, { target: { value: 'Test alert message' } });

      expect(textarea).toHaveValue('Test alert message');
    });

    test('resets form when reset button clicked', () => {
      render(<AlertForm token={mockToken} />);

      const textarea = screen.getByPlaceholderText(/CPU > 90%/i);
      fireEvent.change(textarea, { target: { value: 'Test alert message' } });
      expect(textarea).toHaveValue('Test alert message');

      const resetButton = screen.getByRole('button', { name: /Reset/i });
      fireEvent.click(resetButton);

      expect(textarea).toHaveValue('');
    });
  });

  describe('Form Submission', () => {
    test('shows error when no token provided', async () => {
      const onError = jest.fn();
      render(<AlertForm token="" onError={onError} />);

      const textarea = screen.getByPlaceholderText(/CPU > 90%/i);
      fireEvent.change(textarea, { target: { value: 'Test alert' } });

      const form = textarea.closest('form');
      if (form) fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText(/Please log in/i)).toBeInTheDocument();
      });
    });

    test('submits alert successfully', async () => {
      const onSuccess = jest.fn();
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValueOnce({ id: 'alert-123' }),
      });

      render(<AlertForm token={mockToken} onSuccess={onSuccess} />);

      const textarea = screen.getByPlaceholderText(/CPU > 90%/i);
      fireEvent.change(textarea, { target: { value: 'Test alert message' } });

      const submitButton = screen.getByRole('button', { name: /Create alert/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Alert created/i)).toBeInTheDocument();
      });

      expect(onSuccess).toHaveBeenCalledWith('alert-123');
      expect(textarea).toHaveValue(''); // Form should reset
    });

    test('handles submission error', async () => {
      const onError = jest.fn();
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce({ message: 'Server error' }),
      });

      render(<AlertForm token={mockToken} onError={onError} />);

      const textarea = screen.getByPlaceholderText(/CPU > 90%/i);
      fireEvent.change(textarea, { target: { value: 'Test alert' } });

      const submitButton = screen.getByRole('button', { name: /Create alert/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Server error/i)).toBeInTheDocument();
      });

      expect(onError).toHaveBeenCalledWith('Server error');
    });

    test('handles network error', async () => {
      const onError = jest.fn();
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

      render(<AlertForm token={mockToken} onError={onError} />);

      const textarea = screen.getByPlaceholderText(/CPU > 90%/i);
      fireEvent.change(textarea, { target: { value: 'Test alert' } });

      const submitButton = screen.getByRole('button', { name: /Create alert/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });

    test('shows loading state during submission', async () => {
      let resolvePromise: (value: any) => void;
      global.fetch = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          }),
      );

      render(<AlertForm token={mockToken} />);

      const textarea = screen.getByPlaceholderText(/CPU > 90%/i);
      fireEvent.change(textarea, { target: { value: 'Test alert' } });

      const submitButton = screen.getByRole('button', { name: /Create alert/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Creating…/i)).toBeInTheDocument();
      });

      // Clean up
      resolvePromise!({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ id: 'alert-123' }),
      });
    });
  });

  describe('Circuit Breaker Handling', () => {
    test('displays circuit breaker error message', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: jest.fn().mockResolvedValueOnce({
          message: 'Service temporarily unavailable - circuit breaker is OPEN',
        }),
      });

      render(<AlertForm token={mockToken} />);

      const textarea = screen.getByPlaceholderText(/CPU > 90%/i);
      fireEvent.change(textarea, { target: { value: 'Test alert' } });

      const submitButton = screen.getByRole('button', { name: /Create alert/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/circuit breaker/i)).toBeInTheDocument();
      });
    });
  });
});
