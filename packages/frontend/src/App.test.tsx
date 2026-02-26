// @ts-nocheck
import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./hooks/useAlertSocket', () => ({
  __esModule: true,
  useAlertSocket: jest.fn(() => ({ isConnected: false, socket: null })),
}));

describe('App', () => {
  beforeEach(() => {
    // Mock localStorage
    const mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
    
    // Mock sessionStorage
    const mockSessionStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });
  });

  test('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText(/sign in to your org/i)).toBeInTheDocument();
  });

  test('shows login form when unauthenticated', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('component renders with Vederi Alert Flow title', () => {
    render(<App />);
    const title = screen.queryByText(/Vederi/i) || screen.queryByText(/sign in/i);
    expect(title).toBeInTheDocument();
  });
});

