import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { AuthCard } from '../components/AuthCard';

export const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // PRESERVED: exact register call + verify-otp navigation
      await api.post('/auth/register', { name, email, password });
      navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Create an Account"
      subtitle="Get started with your workspace"
      footer={
        <>
          Already have an account? <Link to="/login">Sign In</Link>
        </>
      }
    >
      {error && (
        <p className="form-error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label htmlFor="register-name">Name</label>
          <input
            id="register-name"
            className="dark-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            className="dark-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            className="dark-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          className="admin-btn"
          disabled={loading}
          aria-busy={loading}
          style={{
            width: '100%',
            justifyContent: 'center',
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Creating account…' : 'Register'}
        </button>
      </form>
    </AuthCard>
  );
};
