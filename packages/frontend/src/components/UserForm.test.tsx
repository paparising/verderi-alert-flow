import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserForm } from './UserForm';
import { OrgUser } from '../types';

describe('UserForm', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Mode', () => {
    describe('Rendering', () => {
      test('renders create form with all fields', () => {
        render(<UserForm token={mockToken} mode="create" />);

        expect(screen.getByText(/Create New User/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Phone/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Address/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Role/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Create user/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
      });

      test('email field is editable in create mode', () => {
        render(<UserForm token={mockToken} mode="create" />);

        const emailInput = screen.getByLabelText(/Email/i);
        expect(emailInput).not.toBeDisabled();
      });
    });

    describe('Form Interaction', () => {
      test('allows filling all fields', () => {
        render(<UserForm token={mockToken} mode="create" />);

        fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'John Doe' } });
        fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'john@example.com' } });
        fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '1234567890' } });
        fireEvent.change(screen.getByLabelText(/Address/i), { target: { value: '123 Main St' } });
        fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });

        expect(screen.getByLabelText(/Name/i)).toHaveValue('John Doe');
        expect(screen.getByLabelText(/Email/i)).toHaveValue('john@example.com');
        expect(screen.getByLabelText(/Phone/i)).toHaveValue('1234567890');
        expect(screen.getByLabelText(/Address/i)).toHaveValue('123 Main St');
        expect(screen.getByLabelText(/Password/i)).toHaveValue('password123');
      });

      test('resets form when reset button clicked', () => {
        render(<UserForm token={mockToken} mode="create" />);

        fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'John Doe' } });
        fireEvent.click(screen.getByRole('button', { name: /Reset/i }));

        expect(screen.getByLabelText(/Name/i)).toHaveValue('');
      });
    });

    describe('Form Submission', () => {
      test('submits user successfully', async () => {
        const onSuccess = jest.fn();
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValueOnce({ id: 'user-123' }),
        });

        render(<UserForm token={mockToken} mode="create" onSuccess={onSuccess} />);

        fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'John Doe' } });
        fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'john@example.com' } });
        fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '1234567890' } });
        fireEvent.change(screen.getByLabelText(/Address/i), { target: { value: '123 Main St' } });
        fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });

        fireEvent.click(screen.getByRole('button', { name: /Create user/i }));

        await waitFor(() => {
          expect(screen.getByText(/User created successfully/i)).toBeInTheDocument();
        });

        expect(onSuccess).toHaveBeenCalled();
      });

      test('handles submission error', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: jest.fn().mockResolvedValueOnce({ message: 'Email already exists' }),
        });

        render(<UserForm token={mockToken} mode="create" />);

        fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'John' } });
        fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'john@example.com' } });
        fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '123' } });
        fireEvent.change(screen.getByLabelText(/Address/i), { target: { value: '123 St' } });
        fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });

        fireEvent.click(screen.getByRole('button', { name: /Create user/i }));

        await waitFor(() => {
          expect(screen.getByText(/Email already exists/i)).toBeInTheDocument();
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

        render(<UserForm token={mockToken} mode="create" />);

        fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'John' } });
        fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'j@e.com' } });
        fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '123' } });
        fireEvent.change(screen.getByLabelText(/Address/i), { target: { value: '123' } });
        fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });

        fireEvent.click(screen.getByRole('button', { name: /Create user/i }));

        await waitFor(() => {
          expect(screen.getByText(/Creating…/i)).toBeInTheDocument();
        });

        // Clean up
        resolvePromise!({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ id: 'user-123' }),
        });
      });
    });
  });

  describe('Edit Mode', () => {
    const mockUser: OrgUser = {
      id: 'user-123',
      name: 'Existing User',
      email: 'existing@example.com',
      phone: '9876543210',
      address: '456 Oak St',
      role: 'admin',
    };

    describe('Rendering', () => {
      test('renders edit form with user data', () => {
        render(<UserForm token={mockToken} mode="edit" user={mockUser} />);

        expect(screen.getByText(/Edit User/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Name/i)).toHaveValue('Existing User');
        expect(screen.getByLabelText(/Email/i)).toHaveValue('existing@example.com');
        expect(screen.getByLabelText(/Phone/i)).toHaveValue('9876543210');
        expect(screen.getByLabelText(/Address/i)).toHaveValue('456 Oak St');
        expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      });

      test('email field is disabled in edit mode', () => {
        render(<UserForm token={mockToken} mode="edit" user={mockUser} />);

        const emailInput = screen.getByLabelText(/Email/i);
        expect(emailInput).toBeDisabled();
      });

      test('password is optional in edit mode', () => {
        render(<UserForm token={mockToken} mode="edit" user={mockUser} />);

        expect(screen.getByText(/leave blank to keep/i)).toBeInTheDocument();
      });
    });

    describe('Form Submission', () => {
      test('updates user successfully', async () => {
        const onSuccess = jest.fn();
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({ id: 'user-123' }),
        });

        render(<UserForm token={mockToken} mode="edit" user={mockUser} onSuccess={onSuccess} />);

        fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Updated Name' } });
        fireEvent.click(screen.getByRole('button', { name: /Save/i }));

        await waitFor(() => {
          expect(screen.getByText(/User updated successfully/i)).toBeInTheDocument();
        });

        expect(onSuccess).toHaveBeenCalled();
      });

      test('handles update error', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: jest.fn().mockResolvedValueOnce({ message: 'Forbidden' }),
        });

        render(<UserForm token={mockToken} mode="edit" user={mockUser} />);

        fireEvent.click(screen.getByRole('button', { name: /Save/i }));

        await waitFor(() => {
          expect(screen.getByText(/Forbidden/i)).toBeInTheDocument();
        });
      });

      test('calls onCancel when cancel button clicked', () => {
        const onCancel = jest.fn();
        render(<UserForm token={mockToken} mode="edit" user={mockUser} onCancel={onCancel} />);

        fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

        expect(onCancel).toHaveBeenCalled();
      });
    });
  });
});
