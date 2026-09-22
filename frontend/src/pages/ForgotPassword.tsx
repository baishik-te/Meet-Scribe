import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { AuthCard } from '../components/AuthCard';

type Step = 'email' | 'otp' | 'password' | 'done';

export const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const noticeStyle: React.CSSProperties = {
    marginBottom: 12,
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--accent-green, #22c55e)',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    color: 'var(--accent-green, #22c55e)',
    fontSize: 13,
    fontWeight: 600,
  };

  // Step 1: send the reset code to the email.
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setInfo('If an account exists for that email, a reset code has been sent.');
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Unable to send reset code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify the OTP.
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await api.post('/auth/verify-reset-otp', { email, otp });
      setInfo('Code verified. Set your new password.');
      setStep('password');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: set the new password.
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword, confirmPassword });
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Could not reset password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const subtitleByStep: Record<Step, string> = {
    email: 'Enter your email and we will send you a reset code.',
    otp: 'Enter the 6-digit code sent to your email.',
    password: 'Choose a new password for your account.',
    done: 'Your password has been updated.',
  };

  return (
    <AuthCard
      title="Reset Password"
      subtitle={subtitleByStep[step]}
      footer={
        <>
          Remembered it? <Link to="/login">Back to sign in</Link>
        </>
      }
    >
      {error && <div className="form-error" role="alert" aria-live="assertive">{error}</div>}
      {info && step !== 'done' && <div role="status" style={noticeStyle}>{info}</div>}

      {step === 'email' && (
        <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
          <div className="form-group">
            <label htmlFor="fp-email">Email</label>
            <input
              id="fp-email"
              className="dark-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="admin-btn"
            disabled={loading || !email}
            style={{ width: '100%', opacity: loading || !email ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Sending…' : 'Send Reset Code'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
          <div className="form-group">
            <label htmlFor="fp-otp">One-Time Password (OTP)</label>
            <input
              id="fp-otp"
              className="dark-input"
              type="text"
              value={otp}
              maxLength={6}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              required
              placeholder="Enter 6-digit code"
              disabled={loading}
              style={{ letterSpacing: 8, fontSize: 18, textAlign: 'center' }}
            />
          </div>
          <button
            type="submit"
            className="admin-btn"
            disabled={loading || otp.length !== 6}
            style={{ width: '100%', opacity: loading || otp.length !== 6 ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Verifying…' : 'Verify Code'}
          </button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
          <div className="form-group">
            <label htmlFor="fp-new-password">New Password</label>
            <input
              id="fp-new-password"
              className="dark-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="form-group">
            <label htmlFor="fp-confirm-password">Confirm Password</label>
            <input
              id="fp-confirm-password"
              className="dark-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="admin-btn"
            disabled={loading || !newPassword || !confirmPassword}
            style={{ width: '100%', opacity: loading || !newPassword || !confirmPassword ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Saving…' : 'Save New Password'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div role="status" style={noticeStyle}>
            Password updated successfully. You can now sign in with your new password.
          </div>
          <button
            type="button"
            className="admin-btn"
            onClick={() => navigate('/login')}
            style={{ width: '100%' }}
          >
            Go to Sign In
          </button>
        </div>
      )}
    </AuthCard>
  );
};
