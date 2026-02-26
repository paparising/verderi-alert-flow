import React, { useState, FormEvent } from 'react';
import { AlertsList } from './components/AlertsList';
import { UsersList } from './components/UsersList';
import './App.css';

type Role = 'superadmin' | 'admin' | 'user';
const ALERT_STATUS_OPTIONS = ['New', 'Acknowledged', 'Resolved'] as const;
type AlertStatus = (typeof ALERT_STATUS_OPTIONS)[number];

interface SessionState {
  token: string;
  orgId: string;
  userId: string;
  role: Role;
  email?: string;
}

interface AlertFormState {
  alertContext: string;
  status: AlertStatus;
}

interface OrgUser {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  address?: string;
  phone?: string;
  createdAt?: string;
}

interface UserFormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  role: 'user' | 'admin';
  password: string;
}

const DEFAULT_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const decodeJwt = (token: string) => {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(atob(payload));
    return {
      userId: decoded.sub as string,
      orgId: decoded.orgId as string,
      role: (decoded.roles?.[0] as Role) || 'user',
      email: decoded.email as string | undefined,
    };
  } catch (err) {
    console.error('Failed to decode JWT', err);
    return null;
  }
};

function App() {
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [session, setSession] = useState<SessionState | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'users'>('alerts');

  const [alertForm, setAlertForm] = useState<AlertFormState>({
    alertContext: '',
    status: 'New',
  });
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertLoading, setAlertLoading] = useState(false);

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>({ name: '', email: '', phone: '', address: '', role: 'user', password: '' });
  const [userFormMessage, setUserFormMessage] = useState<string | null>(null);
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState<UserFormState | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const base = DEFAULT_API_URL.replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.accessToken) {
        throw new Error(body?.message || 'Login failed');
      }

      const decoded = decodeJwt(body.accessToken);
      if (!decoded?.orgId || !decoded?.userId) {
        throw new Error('Token is missing orgId or userId');
      }

      setSession({
        token: body.accessToken,
        orgId: decoded.orgId,
        userId: decoded.userId,
        role: decoded.role,
        email: decoded.email,
      });
      setActiveTab('alerts');
    } catch (err: any) {
      setAuthError(err?.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAlertFormChange = (field: keyof AlertFormState, value: string) => {
    setAlertForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAlertSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) {
      setAlertMessage('Please log in before creating an alert.');
      return;
    }

    setAlertLoading(true);
    setAlertMessage(null);

    const base = DEFAULT_API_URL.replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          alertContext: alertForm.alertContext,
          status: 'New',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to create alert');
      }

      setAlertMessage(`Alert created with id ${data?.id || 'success'}`);
      setAlertForm({ alertContext: '', status: 'New' });
    } catch (err: any) {
      setAlertMessage(err?.message || 'Error creating alert');
    } finally {
      setAlertLoading(false);
    }
  };

  const handleLogout = () => {
    setSession(null);
    setAlertMessage(null);
    setUsers([]);
    setUsersError(null);
    setActiveTab('alerts');
  };

  const loadUsers = async (token: string, orgId: string) => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const base = DEFAULT_API_URL.replace(/\/$/, '');
      const res = await fetch(`${base}/users`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error((body as any)?.message || 'Failed to load users');
      }
      const sorted = (body as OrgUser[]).sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
      setUsers(sorted);
    } catch (err: any) {
      setUsersError(err?.message || 'Error loading users');
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setUserFormLoading(true);
    setUserFormMessage(null);

    const base = DEFAULT_API_URL.replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify(userForm),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to create user');
      }

      setUserFormMessage('User created successfully');
      setUserForm({ name: '', email: '', phone: '', address: '', role: 'user', password: '' });
      await loadUsers(session.token, session.orgId);
    } catch (err: any) {
      setUserFormMessage(err?.message || 'Error creating user');
    } finally {
      setUserFormLoading(false);
    }
  };

  const handleUpdateUser = async (userId: string) => {
    if (!session || !editUserForm) return;

    setUserFormLoading(true);
    setUserFormMessage(null);

    const base = DEFAULT_API_URL.replace(/\/$/, '');
    try {
      const { password, ...rest } = editUserForm;
      const body = password ? { ...rest, password } : rest;
      const res = await fetch(`${base}/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to update user');
      }

      setUserFormMessage('User updated successfully');
      setEditingUserId(null);
      setEditUserForm(null);
      await loadUsers(session.token, session.orgId);
    } catch (err: any) {
      setUserFormMessage(err?.message || 'Error updating user');
    } finally {
      setUserFormLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!session) return;

    const confirmed = window.confirm('Delete this user? This cannot be undone.');
    if (!confirmed) return;

    setUserFormLoading(true);
    setUserFormMessage(null);

    const base = DEFAULT_API_URL.replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.message || 'Failed to delete user');
      }

      setUserFormMessage('User deleted successfully');
      await loadUsers(session.token, session.orgId);
    } catch (err: any) {
      setUserFormMessage(err?.message || 'Error deleting user');
    } finally {
      setUserFormLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>Vederi Alert Flow</h1>
          {session ? (
            <div className="session-badge">
              <span>{session.email || loginForm.email}</span>
              <button className="btn-secondary" onClick={handleLogout}>Log out</button>
            </div>
          ) : (
            <span className="muted">Authenticate to manage alerts</span>
          )}
        </div>
      </header>

      <main className="app-main">
        <div className="content-container auth-wrapper">
          {!session && (
            <section className="auth-card">
              <p className="eyebrow">Login</p>
              <h2>Sign in to your org</h2>
              <p className="muted">Use the admin credentials created by superadmin. We will fetch a JWT and derive org/user context from it.</p>

              {authError && <div className="inline-message error">{authError}</div>}

              <form className="auth-form" onSubmit={handleLogin}>
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="admin@example.com"
                    required
                  />
                </label>

                <label className="field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                    required
                  />
                </label>

                <button type="submit" className="btn-primary" disabled={authLoading}>
                  {authLoading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </section>
          )}

          {session && (
            <>
              <div className="tabs-row">
                <button
                  className={`tab-button ${activeTab === 'alerts' ? 'active' : ''}`}
                  onClick={() => setActiveTab('alerts')}
                >
                  <span className="tab-icon" aria-hidden="true">🔔</span>
                  <span>Alerts</span>
                </button>
                {(session.role === 'admin' || session.role === 'superadmin') && (
                  <button
                    className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('users');
                      loadUsers(session.token, session.orgId);
                    }}
                  >
                    <span className="tab-icon" aria-hidden="true">👤</span>
                    <span>Users</span>
                  </button>
                )}
              </div>

              {activeTab === 'alerts' && (
                <>
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <p className="eyebrow">Alerts</p>
                        <p className="muted">Live list with optional “created by me” and status filters. WebSocket updates included.</p>
                      </div>
                    </div>
                    <AlertsList orgId={session.orgId} apiUrl={DEFAULT_API_URL} token={session.token} />
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <p className="eyebrow">POST New Alerts</p>
                      </div>
                    </div>

                    {alertMessage && <div className="inline-message">{alertMessage}</div>}

                    <form className="alert-form" onSubmit={handleAlertSubmit}>
                      <label className="field">
                        <span>Alert Message</span>
                        <textarea
                          value={alertForm.alertContext}
                          onChange={(e) => handleAlertFormChange('alertContext', e.target.value)}
                          placeholder="CPU > 90% on node-1"
                          required
                        />
                      </label>

                      <div className="form-actions">
                        <button type="submit" className="btn-primary" disabled={alertLoading}>
                          {alertLoading ? 'Creating…' : 'Create alert'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setAlertForm({ alertContext: '', status: 'New' })}
                          disabled={alertLoading}
                        >
                          Reset
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              )}

              {activeTab === 'users' && (session.role === 'admin' || session.role === 'superadmin') && (
                <>
                  <UsersList
                    users={users}
                    loading={usersLoading}
                    error={usersError}
                    sessionRole={session.role}
                    userFormLoading={userFormLoading}
                    onEdit={(u) => {
                      setEditingUserId(u.id);
                      setEditUserForm({ name: u.name || '', email: u.email || '', phone: u.phone || '', address: u.address || '', role: (u.role as 'user' | 'admin') || 'user', password: '' });
                    }}
                    onDelete={handleDeleteUser}
                  />

                  {editingUserId && editUserForm && (
                    <div className="card">
                      <div className="card-header">
                        <div>
                          <p className="eyebrow">Edit User</p>
                          <h3>Update user details</h3>
                        </div>
                      </div>

                      {userFormMessage && <div className="inline-message">{userFormMessage}</div>}

                      <form onSubmit={(e) => { e.preventDefault(); handleUpdateUser(editingUserId); }}>
                        <label className="field">
                          <span>Name</span>
                          <input
                            type="text"
                            value={editUserForm.name}
                            onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                            required
                          />
                        </label>

                        <label className="field">
                          <span>Email</span>
                          <input
                            type="email"
                            value={editUserForm.email}
                            disabled
                            required
                          />
                        </label>

                        <label className="field">
                          <span>Phone</span>
                          <input
                            type="tel"
                            value={editUserForm.phone}
                            onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                            required
                          />
                        </label>

                        <label className="field">
                          <span>Address</span>
                          <input
                            type="text"
                            value={editUserForm.address}
                            onChange={(e) => setEditUserForm({ ...editUserForm, address: e.target.value })}
                            required
                          />
                        </label>

                        <label className="field">
                          <span>Role</span>
                          <select
                            value={editUserForm.role}
                            onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value as 'user' | 'admin' })}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </label>

                        <label className="field">
                          <span>New password (leave blank to keep)</span>
                          <input
                            type="password"
                            value={editUserForm.password}
                            onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                            placeholder="Min 8 characters"
                            minLength={8}
                          />
                        </label>

                        <div className="form-actions">
                          <button type="submit" className="btn-primary" disabled={userFormLoading}>
                            {userFormLoading ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              setEditingUserId(null);
                              setEditUserForm(null);
                            }}
                            disabled={userFormLoading}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <p className="eyebrow">Create New User</p>
                      </div>
                    </div>

                    {userFormMessage && !editingUserId && <div className="inline-message">{userFormMessage}</div>}

                    <form className="alert-form" onSubmit={handleCreateUser}>
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
                        <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'user' | 'admin' })}>
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>

                      <label className="field">
                        <span>Password</span>
                        <input
                          type="password"
                          value={userForm.password}
                          onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                          placeholder="Min 8 characters"
                          required
                          minLength={8}
                        />
                      </label>

                      <div className="form-actions">
                        <button type="submit" className="btn-primary" disabled={userFormLoading}>
                          {userFormLoading ? 'Creating…' : 'Create user'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setUserForm({ name: '', email: '', phone: '', address: '', role: 'user', password: '' })}
                          disabled={userFormLoading}
                        >
                          Reset
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export { App };
export default App;
