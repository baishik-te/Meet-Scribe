import React, { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { InlineNotice, InlineNoticeVariant } from '../components/InlineNotice';
import api from '../api/client';

/**
 * Pure predicate for the Settings password-change validation.
 *
 * Returns true if and only if the new and confirm passwords are equal AND the
 * new password is at least 6 characters long. The submit handler calls
 * `PATCH /user/password` if and only if this predicate returns true.
 *
 * Exported for reuse by the property test (task 11.3). Keep it pure and free
 * of side effects.
 */
export function isValidPasswordChange(newPassword: string, confirmPassword: string): boolean {
  return newPassword === confirmPassword && newPassword.length >= 6;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  padding: 24,
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-color)',
  maxWidth: 600,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  background: 'var(--bg-card-secondary)',
  border: '1px solid var(--border-color)',
  color: '#fff',
  borderRadius: 'var(--radius-md)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: 6,
};

export const Settings: React.FC = () => {
  // Device-default toggles remain local UI state only.
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [tokenAlerts, setTokenAlerts] = useState(true);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordMsgType, setPasswordMsgType] = useState<InlineNoticeVariant>('success');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');

    // Submit iff the pure predicate holds; otherwise inline validation error, no request.
    if (!isValidPasswordChange(newPassword, confirmPassword)) {
      setPasswordMsgType('error');
      setPasswordMsg(
        newPassword !== confirmPassword
          ? 'New passwords do not match'
          : 'New password must be at least 6 characters long'
      );
      return;
    }

    try {
      await api.patch('/user/password', { oldPassword, newPassword });
      setPasswordMsgType('success');
      setPasswordMsg('Password successfully updated');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsgType('error');
      setPasswordMsg(err.response?.data?.error?.message || 'Password update failed');
    }
  };

  return (
    <AppShell title="System Settings">
      {/* Device & Call Defaults */}
      <section
        style={{
          ...cardStyle,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          marginBottom: 28,
        }}
      >
        <h3 style={{ margin: 0 }}>Device & Call Defaults</h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>Enable Microphone on Call Join</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Automatically publish your audio stream
            </div>
          </div>
          <input
            type="checkbox"
            checked={micActive}
            onChange={(e) => setMicActive(e.target.checked)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>Enable Camera on Call Join</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Automatically publish your video stream
            </div>
          </div>
          <input
            type="checkbox"
            checked={camActive}
            onChange={(e) => setCamActive(e.target.checked)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>Low Token In-Call Audio Alerts</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Play alert chime when remaining balance drops under 15
            </div>
          </div>
          <input
            type="checkbox"
            checked={tokenAlerts}
            onChange={(e) => setTokenAlerts(e.target.checked)}
          />
        </div>
      </section>

      {/* Security / Change Password */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Security & Password</h3>
        <InlineNotice
          message={passwordMsg}
          variant={passwordMsgType}
          onDismiss={() => setPasswordMsg('')}
        />
        <form onSubmit={handleChangePassword}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Current Password</label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            style={{
              background: 'var(--accent-blue)',
              border: 'none',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Update Password
          </button>
        </form>
      </section>
    </AppShell>
  );
};

export default Settings;
