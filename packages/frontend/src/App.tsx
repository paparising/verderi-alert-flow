import React, { useState, FormEvent } from 'react';
import './App.css';

interface UserForm {
  name: string;
  address: string;
  email: string;
  phone: string;
  organizationId: string;
}

function App() {
  const [showUserModal, setShowUserModal] = useState(false);
  const [form, setForm] = useState<UserForm>({
    name: '',
    address: '',
    email: '',
    phone: '',
    organizationId: '',
  });
  const [message, setMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    try {
      const res = await fetch(`${apiUrl}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      setMessage('User created with id ' + data.id);
      setForm({ name: '', address: '', email: '', phone: '', organizationId: '' });
      setTimeout(() => {
        setShowUserModal(false);
        setMessage(null);
      }, 2000);
    } catch (err) {
      setMessage('Error creating user');
      console.error(err);
    }
  };

  return (
    <div className="App">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>Vederi Alert Flow</h1>
          <button className="btn-primary">Admin Dashboard</button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="app-nav">
        <div className="nav-tabs">
          <button className="tab active">
            <span className="icon">📋</span> Dashboard (0)
          </button>
          <button className="tab">
            <span className="icon">⚙️</span> Settings (0)
          </button>
          <button className="tab">
            <span className="icon">📊</span> Summary
          </button>
          <button className="tab">
            <span className="icon">📈</span> Report
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="app-main">
        <div className="content-container">
          <div className="welcome-section">
            <div className="icon-large">👥</div>
            <h2>Admin Control Panel</h2>
            <p>Manage users and organizations</p>
          </div>

          <div className="action-buttons">
            <button className="btn-action" onClick={() => setShowUserModal(true)}>
              <span className="btn-icon">➕</span>
              Create User
            </button>
            <button className="btn-action">
              <span className="btn-icon">🏢</span>
              Create Organization
            </button>
          </div>
        </div>
      </main>

      {/* Modal Overlay */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New User</h3>
              <button className="btn-close" onClick={() => setShowUserModal(false)}>
                ✕
              </button>
            </div>

            {message && <div className="message">{message}</div>}

            <form onSubmit={handleSubmit} className="user-form">
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Address *</label>
                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Enter address"
                  required
                />
              </div>

              <div className="form-group">
                <label>Phone *</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                  required
                />
              </div>

              <div className="form-group">
                <label>Organization ID *</label>
                <input
                  name="organizationId"
                  value={form.organizationId}
                  onChange={handleChange}
                  placeholder="Enter organization UUID"
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
