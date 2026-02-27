import React, { useState, FormEvent } from 'react';
import { AlertsList } from './components/AlertsList';
import { UsersList } from './components/UsersList';
import { AlertForm } from './components/AlertForm';
import { UserForm } from './components/UserForm';
import { SessionState, OrgUser, DEFAULT_API_URL, decodeJwt } from './types';
import './App.css';

function App() {
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [session, setSession] = useState<SessionState | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'users'>('alerts');

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null);

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

  const handleLogout = () => {
    setSession(null);
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

  const handleDeleteUser = async (userId: string) => {
    if (!session) return;

    const confirmed = window.confirm('Delete this user? This cannot be undone.');
    if (!confirmed) return;

    setUsersLoading(true);
    setUsersError(null);

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

      await loadUsers(session.token, session.orgId);
    } catch (err: any) {
      setUsersError(err?.message || 'Error deleting user');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleUserFormSuccess = () => {
    if (session) {
      loadUsers(session.token, session.orgId);
    }
    setEditingUser(null);
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>Videri Alert Flow</h1>
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

                    <AlertForm token={session.token} />
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
                    userFormLoading={usersLoading}
                    onEdit={(u) => setEditingUser(u)}
                    onDelete={handleDeleteUser}
                  />

                  {editingUser && (
                    <UserForm
                      token={session.token}
                      mode="edit"
                      user={editingUser}
                      onSuccess={handleUserFormSuccess}
                      onCancel={() => setEditingUser(null)}
                    />
                  )}

                  <UserForm
                    token={session.token}
                    mode="create"
                    onSuccess={handleUserFormSuccess}
                  />
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
