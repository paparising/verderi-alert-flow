import React from 'react';
import { Role, OrgUser } from '../types';

// Re-export for backwards compatibility
export type { Role, OrgUser };

interface UsersListProps {
  users: OrgUser[];
  loading: boolean;
  error: string | null;
  sessionRole?: Role;
  userFormLoading?: boolean;
  onEdit: (user: OrgUser) => void;
  onDelete: (userId: string) => void;
}

export const UsersList: React.FC<UsersListProps> = ({
  users,
  loading,
  error,
  sessionRole,
  userFormLoading = false,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Org users</p>
          <h3>Manage users in this organization</h3>
        </div>
        {sessionRole && (
          <div className="role-chip" data-role={sessionRole}>
            <span className="dot" /> {sessionRole}
          </div>
        )}
      </div>

      {loading && <div className="inline-message">Loading users…</div>}
      {error && <div className="inline-message error">{error}</div>}

      {!loading && !error && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Actions</th>
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
                  <td>
                    <button
                      className="btn-primary"
                      onClick={() => onEdit(u)}
                      disabled={userFormLoading}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => onDelete(u.id)}
                      disabled={userFormLoading}
                      style={{ marginLeft: '0.5rem' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
