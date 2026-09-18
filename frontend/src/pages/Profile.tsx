import React, { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { AppShell } from '../components/AppShell';
import { InlineNotice } from '../components/InlineNotice';
import { isActivePlan } from '../lib/planSelection';
import type { PlanVM, SubscriptionVM } from '../types/viewModels';

export const Profile: React.FC = () => {
  const [balance, setBalance]           = useState<number>(0);
  const [subscription, setSubscription] = useState<SubscriptionVM | null>(null);
  const [plans, setPlans]               = useState<PlanVM[]>([]);
  const [loading, setLoading]           = useState(false);
  const [loadingPlan, setLoadingPlan]   = useState<string | null>(null);
  const [successMsg, setSuccessMsg]     = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // ── Editable account section state (GET/PATCH /user/profile) ──
  const [accountName, setAccountName]   = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const [balRes, subRes, plansRes] = await Promise.all([
        api.get('/user/wallet/balance'),
        api.get('/user/subscription'),
        api.get('/user/plans'),
      ]);
      setBalance(balRes.data.data.balance);
      setSubscription(subRes.data.data.subscription);
      setPlans(plansRes.data.data.plans);
      return subRes.data.data.subscription; // return so poll can check
    } catch (err) {
      console.error('Profile load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load the current account details from GET /user/profile.
  const fetchAccount = async () => {
    try {
      const res = await api.get('/user/profile');
      const profile = res.data.data.user;
      setAccountName(profile?.name ?? '');
      setAccountEmail(profile?.email ?? '');
    } catch (err) {
      console.error('Account load error:', err);
    }
  };

  useEffect(() => {
    fetchProfileData();
    fetchAccount();

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      window.history.replaceState({}, '', '/profile');
      setSuccessMsg('Payment received! Activating your plan...');
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        const sub = await fetchProfileData();
        if (sub) {
          clearInterval(pollRef.current!);
          setSuccessMsg(`Plan activated: ${sub.plan?.name}`);
          setTimeout(() => setSuccessMsg(''), 5000);
        }
        if (attempts >= 15) clearInterval(pollRef.current!);
      }, 2000);
    }

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleUpgrade = async (planId: string) => {
    try {
      setCheckoutError(null);
      setLoadingPlan(planId);
      const res = await api.post('/user/checkout', { planId });
      window.location.href = res.data.data.checkoutUrl;
    } catch (err: any) {
      setCheckoutError(err.response?.data?.error?.message || 'Checkout failed');
      setLoadingPlan(null);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);
    setAccountSuccess(null);
    if (!accountName.trim()) {
      setAccountError('Name cannot be empty.');
      return;
    }
    try {
      setSavingAccount(true);
      const res = await api.patch('/user/profile', { name: accountName.trim() });
      const updated = res.data.data.user;
      setAccountName(updated?.name ?? accountName.trim());
      setAccountSuccess('Profile updated.');
      setTimeout(() => setAccountSuccess(null), 4000);
    } catch (err: any) {
      setAccountError(err.response?.data?.error?.message || 'Failed to update profile');
    } finally {
      setSavingAccount(false);
    }
  };

  const activePlanId = subscription?.planId;

  return (
    <AppShell title="Account & Membership">

      {/* ── Success toast ── */}
      {successMsg && (
        <InlineNotice
          message={successMsg}
          variant="success"
        />
      )}

      {/* ── Editable account section (GET/PATCH /user/profile) ── */}
      <section style={{
        background: 'var(--bg-card)',
        padding: 24,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        marginBottom: 28,
      }}>
        <h3 style={{ marginTop: 0 }}>Account Details</h3>

        <InlineNotice
          message={accountError}
          variant="error"
          onDismiss={() => setAccountError(null)}
        />
        <InlineNotice
          message={accountSuccess}
          variant="success"
          onDismiss={() => setAccountSuccess(null)}
        />

        <form onSubmit={handleSaveAccount} style={{ display: 'grid', gap: 16, maxWidth: 460 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="account-name" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Display Name
            </label>
            <input
              id="account-name"
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Your name"
              style={{
                background: 'var(--bg-card-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                padding: '10px 14px',
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="account-email" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Email
            </label>
            <input
              id="account-email"
              type="email"
              value={accountEmail}
              disabled
              readOnly
              style={{
                background: 'var(--bg-card-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                padding: '10px 14px',
                fontSize: 14,
                cursor: 'not-allowed',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Email cannot be changed here.
            </span>
          </div>

          <div>
            <button
              type="submit"
              disabled={savingAccount}
              style={{
                background: 'var(--accent-blue)',
                border: 'none',
                color: '#fff',
                padding: '10px 24px',
                borderRadius: 'var(--radius-pill)',
                fontWeight: 600,
                fontSize: 14,
                cursor: savingAccount ? 'default' : 'pointer',
                opacity: savingAccount ? 0.7 : 1,
              }}
            >
              {savingAccount ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>

      {/* ── Active plan card ── */}
      <section style={{
        background: subscription
          ? 'linear-gradient(135deg, #1e3a5f 0%, #1c202e 100%)'
          : 'var(--bg-card)',
        padding: 28,
        borderRadius: 'var(--radius-lg)',
        border: subscription ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
        marginBottom: 28,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Current Plan {loading && <span style={{ opacity: 0.6 }}>(refreshing…)</span>}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-blue)' }}>
              {subscription?.plan?.name ?? 'Free Tier'}
            </div>
            {subscription?.plan && (
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
                ${subscription.plan.price}/month · renews {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : '—'}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 28 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Token Balance</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{balance.toLocaleString()}</div>
              {subscription?.plan && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {subscription.plan.monthlyTokenQuota.toLocaleString()} / mo
                </div>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Status</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: subscription ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)',
                color: subscription ? '#10b981' : 'var(--text-secondary)',
                padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: 13, marginTop: 4,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: subscription ? '#10b981' : 'var(--text-secondary)',
                  display: 'inline-block',
                }} />
                {subscription?.status ?? 'NO PLAN'}
              </div>
            </div>
          </div>
        </div>

        {subscription?.plan && (
          <div style={{
            marginTop: 20,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 10, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            {[
              { icon: '📹', label: 'Video', value: `${subscription.plan.videoRatePerMinute} t/min` },
              { icon: '⏺', label: 'Recording', value: `${subscription.plan.recordingRatePerMinute} t/min` },
              { icon: '🎙', label: 'Transcription', value: `${subscription.plan.transcriptionRatePerMinute} t/min` },
              { icon: '🧠', label: 'Gemini AI', value: `${subscription.plan.geminiRatePerRequest} t/req` },
            ].map(f => (
              <div key={f.label} style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px',
                fontSize: 13,
              }}>
                <span style={{ marginRight: 6 }}>{f.icon}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{f.label}: </span>
                <span style={{ fontWeight: 600 }}>{f.value}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Plans ── */}
      <section style={{
        background: 'var(--bg-card)',
        padding: 24, borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)', marginBottom: 28,
      }}>
        <h3 style={{ marginTop: 0 }}>{subscription ? 'Change Plan' : 'Choose a Plan'}</h3>

        <InlineNotice
          message={checkoutError}
          variant="error"
          onDismiss={() => setCheckoutError(null)}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {plans.map((p) => {
            const isActive = isActivePlan(p.id, activePlanId);
            return (
              <div key={p.id} style={{
                background: isActive ? 'rgba(37,99,235,0.08)' : 'var(--bg-card-secondary)',
                padding: 20, borderRadius: 'var(--radius-md)',
                border: isActive ? '2px solid var(--accent-blue)' : '1px solid transparent',
                position: 'relative',
              }}>
                {isActive && (
                  <div style={{
                    position: 'absolute', top: -11, right: 12,
                    background: 'var(--accent-blue)', color: '#fff',
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                  }}>ACTIVE</div>
                )}
                <div style={{ fontWeight: 700, fontSize: 16, color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)' }}>{p.name}</div>
                <div style={{ fontSize: 22, fontWeight: 700, margin: '6px 0' }}>${p.price}/mo</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  {p.monthlyTokenQuota.toLocaleString()} Tokens/month
                </div>
                <button
                  disabled={isActive || loadingPlan === p.id}
                  onClick={() => handleUpgrade(p.id)}
                  style={{
                    width: '100%',
                    background: isActive ? 'transparent' : 'var(--accent-blue)',
                    border: isActive ? '1px solid var(--accent-blue)' : 'none',
                    color: isActive ? 'var(--accent-blue)' : '#fff',
                    padding: '9px 0', borderRadius: 'var(--radius-pill)',
                    cursor: isActive ? 'default' : 'pointer', fontWeight: 600, fontSize: 14,
                  }}
                >
                  {isActive ? '✓ Current Plan' : loadingPlan === p.id ? 'Redirecting...' : 'Switch to Plan'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

    </AppShell>
  );
};
