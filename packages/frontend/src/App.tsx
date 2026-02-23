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
    } catch (err) {
      setMessage('Error creating user');
      console.error(err);
    }
  };

  return (
    <div className="App">
      <h1>Create User</h1>
      {message && <p>{message}</p>}
      <form onSubmit={handleSubmit} className="user-form">
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Name"
          required
        />
        <input
          name="address"
          value={form.address}
          onChange={handleChange}
          placeholder="Address"
          required
        />
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Email"
          required
        />
        <input
          name="phone"
          value={form.phone}
          onChange={handleChange}
          placeholder="Phone"
          required
        />
        <input
          name="organizationId"
          value={form.organizationId}
          onChange={handleChange}
          placeholder="Organization ID"
          required
        />
        <button type="submit">Create</button>
      </form>
    </div>
  );
}

export default App;
