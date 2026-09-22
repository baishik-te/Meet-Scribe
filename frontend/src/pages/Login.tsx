// frontend/src/pages/Login.tsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AuthCard } from '../components/AuthCard';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.data.token, res.data.data.user);
      if (res.data.data.user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error?.code;
      const errorMessage = err.response?.data?.error?.message;
      const userEmail = err.response?.data?.error?.email;

      // Handle INACTIVE user - redirect to OTP verification
      if (errorCode === 'ACCOUNT_INACTIVE' && userEmail) {
        // Store email in localStorage temporarily for OTP page
        localStorage.setItem('pendingVerificationEmail', userEmail);
        navigate(`/verify-otp?email=${encodeURIComponent(userEmail)}`);
        return;
      }

      // Display other errors
      const displayError =
        errorMessage ||
        err.message ||
        'Unable to connect to backend server';
      setError(displayError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Sign In"
      subtitle="Welcome back — sign in to continue"
      footer={
        <>
          Don't have an account? <Link to="/register">Register here</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="form-group">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="dark-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="dark-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          <div style={{ textAlign: 'right', marginTop: 6 }}>
            <Link
              to="/forgot-password"
              style={{ fontSize: 13, color: 'var(--accent-blue)', textDecoration: 'none' }}
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <div className="form-error" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="admin-btn"
          disabled={loading}
          style={{ width: '100%', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading && (
            <span
              aria-hidden="true"
              style={{
                width: 16,
                height: 16,
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'auth-spin 0.7s linear infinite',
              }}
            />
          )}
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </AuthCard>
  );
};
