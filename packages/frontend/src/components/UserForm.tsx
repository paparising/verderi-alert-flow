import React, { useState, FormEvent, useEffect } from 'react';
import { UserFormState, OrgUser, DEFAULT_API_URL } from '../types';

interface UserFormProps {
  token: string;
  mode: 'create' | 'edit';
  user?: OrgUser;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const INITIAL_FORM_STATE: UserFormState = {
  name: '',
  email: '',
  phone: '',
  address: '',
  role: 'user',
  password: '',
};

export const UserForm: React.FC<UserFormProps> = ({
  token,
  mode,
  user,
  onSuccess,
  onCancel,
}) => {
  const [userForm, setUserForm] = useState<UserFormState>(INITIAL_FORM_STATE);
  const [userFormMessage, setUserFormMessage] = useState<string | null>(null);
  const [userFormLoading, setUserFormLoading] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && user) {
      setUserForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        role: (user.role as 'user' | 'admin') || 'user',
        password: '',
      });
    } else {
      setUserForm(INITIAL_FORM_STATE);
    }
  }, [mode, user]);

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setUserFormLoading(true);
    setUserFormMessage(null);

    const base = DEFAULT_API_URL.replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userForm),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to create user');
      }

      setUserFormMessage('User created successfully');
      setUserForm(INITIAL_FORM_STATE);
      onSuccess?.();
    } catch (err: any) {
      setUserFormMessage(err?.message || 'Error creating user');
    } finally {
      setUserFormLoading(false);
    }
  };

  const handleUpdateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !user) return;

    setUserFormLoading(true);
    setUserFormMessage(null);

    const base = DEFAULT_API_URL.replace(/\/$/, '');
    try {
      const { password, ...rest } = userForm;
      const body = password ? { ...rest, password } : rest;
      const res = await fetch(`${base}/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to update user');
      }

      setUserFormMessage('User updated successfully');
      onSuccess?.();
    } catch (err: any) {
      setUserFormMessage(err?.message || 'Error updating user');
    } finally {
      setUserFormLoading(false);
    }
  };

  const handleReset = () => {
    if (mode === 'edit' && user) {
      setUserForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        role: (user.role as 'user' | 'admin') || 'user',
        password: '',
      });
    } else {
      setUserForm(INITIAL_FORM_STATE);
    }
    setUserFormMessage(null);
  };

  const isEditMode = mode === 'edit';
  const handleSubmit = isEditMode ? handleUpdateUser : handleCreateUser;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="eyebrow">{isEditMode ? 'Edit User' : 'Create New User'}</p>
          {isEditMode && <h3>Update user details</h3>}
        </div>
      </div>

      {userFormMessage && <div className="inline-message">{userFormMessage}</div>}

      <form className="alert-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            value={userForm.name}
            onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
            placeholder="John Doe"
            required
          />
        </label>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={userForm.email}
            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            placeholder="john@example.com"
            disabled={isEditMode}
            required
          />
        </label>

        <label className="field">
          <span>Phone</span>
          <input
            type="tel"
            value={userForm.phone}
            onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
            placeholder="+1234567890"
            required
          />
        </label>

        <label className="field">
          <span>Address</span>
          <input
            type="text"
            value={userForm.address}
            onChange={(e) => setUserForm({ ...userForm, address: e.target.value })}
            placeholder="123 Main St"
            required
          />
        </label>

        <label className="field">
          <span>Role</span>
          <select
            value={userForm.role}
            onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'user' | 'admin' })}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </label>

        <label className="field">
          <span>{isEditMode ? 'New password (leave blank to keep)' : 'Password'}</span>
          <input
            type="password"
            value={userForm.password}
            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            placeholder="Min 8 characters"
            required={!isEditMode}
            minLength={8}
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={userFormLoading}>
            {userFormLoading ? (isEditMode ? 'Saving…' : 'Creating…') : (isEditMode ? 'Save' : 'Create user')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={isEditMode && onCancel ? onCancel : handleReset}
            disabled={userFormLoading}
          >
            {isEditMode ? 'Cancel' : 'Reset'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserForm;
