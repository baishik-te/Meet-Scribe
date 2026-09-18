import React, { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { AppShell } from '../components/AppShell';
import { InlineNotice } from '../components/InlineNotice';
import { useAuth } from '../context/AuthContext';
import { isActivePlan } from '../lib/planSelection';
import type { LedgerEntryVM, PlanVM, SubscriptionVM } from '../types/viewModels';

export const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const [balance, setBalance]           = useState<number>(0);
  const [plans, setPlans]               = useState<PlanVM[]>([]);
  const [ledger, setLedger]             = useState<LedgerEntryVM[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionVM | null>(null);
  const [loadingPlan, setLoadingPlan]   = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    try {
      const [balRes, plansRes, ledgerRes, subRes] = await Promise.all([
        api.get('/user/wallet/balance'),
        api.get('/user/plans'),
        api.get('/user/wallet/ledger?limit=6'),
        api.get('/user/subscription'),
      ]);
      setBalance(balRes.data.data.balance);
      setPlans(plansRes.data.data.plans);
      setLedger(ledgerRes.data.data.entries);
      setSubscription(subRes.data.data.subscription);
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  };

  useEffect(() => {
    fetchData();

    // If redirected back after Stripe payment, poll until subscription appears
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      window.history.replaceState({}, '', '/dashboard');
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        await fetchData();
        if (attempts >= 15) {
          clearInterval(pollRef.current!);
        }
      }, 2000);
    }

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleSubscribe = async (planId: string) => {
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

  const activePlanId = subscription?.planId;

  const balanceBadge = (
    <div className="pill-badge" style={{ borderColor: 'var(--accent-blue)' }}>
      💎 {balance.toLocaleString()} Available Tokens
    </div>
  );

  return (
    <AppShell title={`Welcome back, ${user?.name ?? ''}`} headerRight={balanceBadge}>

      {subscription?.plan && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Active plan: <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{subscription.plan.name}</span>
        </div>
      )}

      <InlineNotice
        message={checkoutError}
        variant="error"
        onDismiss={() => setCheckoutError(null)}
      />

      {/* ── Active subscription banner ── */}
      {subscription && (
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #1c202e 100%)',
          border: '1px solid var(--accent-blue)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 24px',
          marginBottom: 28,
          display: 'flex',
          gap: 32,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>Current Plan</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-blue)' }}>{subscription.plan.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>${subscription.plan.price}/month</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>Token Balance</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{balance.toLocaleString()}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{subscription.plan.monthlyTokenQuota.toLocaleString()} / month</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>Status</div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(16,185,129,0.15)', color: '#10b981',
              padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: 13,
            }}>
              <span style={{ width: 7, height: 7, background: '#10b981', borderRadius: '50%', display: 'inline-block' }} />
              {subscription.status}
            </div>
            {subscription.currentPeriodEnd && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </div>
            )}
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>📹 Video: {subscription.plan.videoRatePerMinute} t/min</span>
            <span>⏺ Recording: {subscription.plan.recordingRatePerMinute} t/min</span>
            <span>🎙 Transcription: {subscription.plan.transcriptionRatePerMinute} t/min</span>
            <span>🧠 Gemini AI: {subscription.plan.geminiRatePerRequest} t/req</span>
          </div>
        </div>
      )}

      {/* ── Plans marketplace ── */}
      <section style={{ marginBottom: 36 }}>
        <h3 style={{ marginBottom: 16 }}>
          {subscription ? 'Change Plan' : 'Subscription & Dynamic Token Rate Card'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {plans.map(p => {
            const isActive = isActivePlan(p.id, activePlanId);
            return (
              <div
                key={p.id}
                style={{
                  background: isActive ? 'linear-gradient(135deg, #1e3a5f 0%, #1c202e 100%)' : 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: isActive ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  position: 'relative',
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute', top: -12, right: 16,
                    background: 'var(--accent-blue)', color: '#fff',
                    fontSize: 11, fontWeight: 700, padding: '3px 10px',
                    borderRadius: 999, letterSpacing: 0.5,
                  }}>
                    ACTIVE PLAN
                  </div>
                )}
                <div style={{ fontWeight: 600, fontSize: 18, color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)' }}>{p.name}</div>
                <div style={{ fontSize: 32, fontWeight: 700 }}>
                  ${p.price} <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>/ month</span>
                </div>
                <div style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                  {p.monthlyTokenQuota.toLocaleString()} Monthly Tokens
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <li>📹 Video Call: {p.videoRatePerMinute} tokens/min</li>
                  <li>⏺ Cloud Recording: {p.recordingRatePerMinute} tokens/min</li>
                  <li>🎙 Live Transcription: {p.transcriptionRatePerMinute} tokens/min</li>
                  <li>🧠 Gemini AI Query: {p.geminiRatePerRequest} tokens/req</li>
                </ul>
                <button
                  disabled={isActive || loadingPlan === p.id}
                  onClick={() => handleSubscribe(p.id)}
                  style={{
                    marginTop: 'auto',
                    background: isActive ? 'rgba(37,99,235,0.2)' : 'var(--accent-blue)',
                    border: isActive ? '1px solid var(--accent-blue)' : 'none',
                    color: isActive ? 'var(--accent-blue)' : '#fff',
                    padding: '12px 0',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 600,
                    cursor: isActive ? 'default' : 'pointer',
                  }}
                >
                  {isActive ? '✓ Current Plan' : loadingPlan === p.id ? 'Redirecting...' : 'Select Plan'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Ledger ── */}
      <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 24, border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginTop: 0 }}>Recent Token Ledger Events</h3>
        {ledger.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No transactions yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: 10 }}>Date</th>
                <th style={{ padding: 10 }}>Type</th>
                <th style={{ padding: 10 }}>Change</th>
                <th style={{ padding: 10 }}>Balance After</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: 10 }}>{new Date(e.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: 10, fontSize: 13 }}>{e.transactionType}</td>
                  <td style={{ padding: 10, color: e.amount > 0 ? '#10b981' : 'var(--accent-red)', fontWeight: 600 }}>
                    {e.amount > 0 ? `+${e.amount}` : e.amount}
                  </td>
                  <td style={{ padding: 10 }}>{e.balanceAfter?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

    </AppShell>
  );
};
