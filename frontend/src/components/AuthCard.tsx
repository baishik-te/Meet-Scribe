import React from 'react';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Shared presentational wrapper for authentication pages (Login, Register, VerifyOtp).
 * Renders a centered `.auth-card` on a full-viewport `--bg-main` container with no Nav_Rail.
 */
export const AuthCard: React.FC<AuthCardProps> = ({ title, subtitle, children, footer }) => {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: 'var(--bg-main)',
      }}
    >
      <div className="auth-card">
        <div className="auth-card__header">
          <div>{title}</div>
          {subtitle && (
            <div
              style={{
                marginTop: 8,
                fontSize: 14,
                fontWeight: 400,
                color: 'var(--text-secondary)',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {children}
        {footer && (
          <div
            style={{
              marginTop: 20,
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
