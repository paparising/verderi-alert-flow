import React, { useState, FormEvent } from 'react';
import { AlertsList } from './components/AlertsList';
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
                <div className="card">
                  <div className="card-header">
                    <div>
                      <p className="eyebrow">Org users</p>
                      <h3>Manage users in this organization</h3>
                      <p className="muted">Read-only list for now. Add/edit flows can be wired next.</p>
                    </div>
                    <div className="role-chip" data-role={session.role}>
                      <span className="dot" /> {session.role}
                    </div>
                  </div>

                  {usersLoading && <div className="inline-message">Loading users…</div>}
                  {usersError && <div className="inline-message error">{usersError}</div>}

                  {!usersLoading && !usersError && (
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Phone</th>
                            <th>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.length === 0 && (
                            <tr>
                              <td colSpan={5} className="muted">No users found.</td>
                            </tr>
                          )}
                          {users.map((u) => (
                            <tr key={u.id}>
                              <td>{u.name || '—'}</td>
                              <td>{u.email || '—'}</td>
                              <td><span className="pill muted-pill">{u.role || 'user'}</span></td>
                              <td>{u.phone || '—'}</td>
                              <td>{u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
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
