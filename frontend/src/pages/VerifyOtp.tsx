import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AuthCard } from '../components/AuthCard';

export const VerifyOtp: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || localStorage.getItem('pendingVerificationEmail') || '');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Clear pending verification email after component mounts
  useEffect(() => {
    return () => {
      localStorage.removeItem('pendingVerificationEmail');
    };
  }, []);

  // Start countdown timer
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await api.post('/auth/verify-email', { email, otp });
      
      if (res.data.data.token && res.data.data.user) {
        login(res.data.data.token, res.data.data.user);
        
        localStorage.removeItem('pendingVerificationEmail');
        navigate('/dashboard');
      } else {
        setError('Verification successful but login data missing. Please try logging in.');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Verification failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    
    setResendLoading(true);
    setError('');
    setResendMessage('');

    try {
      await api.post('/user/otp/resend', { email });
      setResendMessage('New OTP sent to your email address');
      setResendTimer(120); // 2 minutes countdown
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to resend OTP');
    } finally {
      setResendLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const verifyDisabled = loading || otp.length !== 6;

  return (
    <AuthCard
      title="Email Verification"
      subtitle="Enter the 6-digit code dispatched to your email address."
    >
      {error && <div className="form-error" role="alert">{error}</div>}
      {resendMessage && (
        <div
          role="status"
          style={{
            marginTop: 4,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--accent-green, #22c55e)',
            backgroundColor: 'rgba(34, 197, 94, 0.12)',
            color: 'var(--accent-green, #22c55e)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {resendMessage}
        </div>
      )}

      <form onSubmit={handleVerify} style={{ marginTop: 16 }}>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>Email</label>
          <input
            className="dark-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label>One-Time Password (OTP)</label>
          <input
            className="dark-input"
            type="text"
            value={otp}
            maxLength={6}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            required
            placeholder="Enter 6-digit code"
            disabled={loading}
            style={{
              letterSpacing: 8,
              fontSize: 18,
              textAlign: 'center' as const,
            }}
          />
        </div>

        <button
          className="admin-btn"
          type="submit"
          disabled={verifyDisabled}
          style={{
            width: '100%',
            opacity: verifyDisabled ? 0.6 : 1,
            cursor: verifyDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Verifying...' : 'Verify & Continue'}
        </button>
      </form>

      <div
        style={{
          textAlign: 'center',
          borderTop: '1px solid var(--border-color)',
          paddingTop: 16,
          marginTop: 20,
        }}
      >
        <p style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
          Didn't receive the code?
        </p>

        <button
          className="admin-btn"
          type="button"
          onClick={handleResendOtp}
          disabled={resendLoading || resendTimer > 0}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid var(--accent-blue)',
            color: resendTimer > 0 ? 'var(--text-secondary)' : 'var(--accent-blue)',
            opacity: resendLoading || resendTimer > 0 ? 0.7 : 1,
            cursor: resendLoading || resendTimer > 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {resendLoading ? 'Sending...' :
           resendTimer > 0 ? `Resend in ${formatTime(resendTimer)}` :
           'Resend OTP'}
        </button>

        {resendTimer > 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            You can request a new code in {formatTime(resendTimer)}
          </p>
        )}
      </div>
    </AuthCard>
  );
};
