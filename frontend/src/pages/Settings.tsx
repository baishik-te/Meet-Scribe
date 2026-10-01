import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { InlineNotice, InlineNoticeVariant } from '../components/InlineNotice';
import '../styles/settings.css';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { isActivePlan, formatBillingPeriod } from '../lib/planSelection';
import type { PlanVM, SubscriptionVM } from '../types/viewModels';

export function isValidPasswordChange(newPassword: string, confirmPassword: string): boolean {
  return newPassword === confirmPassword && newPassword.length >= 6;
}

// --- Premium SVG Icons ---
const Icons = {
  Video: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
  ),
  Recording: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3" fill="currentColor"></circle></svg>
  ),
  Transcription: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
  ),
  AI: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4M3 5h4"></path></svg>
  ),
  Refresh: ({ spinning }: { spinning?: boolean }) => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        animation: spinning ? 'spin 1s linear infinite' : undefined,
        transformOrigin: 'center center'
      }}
    >
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
  )
};

// --- Reusable Styled Rate Item ---
const FeatureRateItem = ({ icon, label, rate, unit, color }: { icon: React.ReactNode; label: string; rate: number; unit: string; color: { bg: string; text: string } }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px', background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)',
    minWidth: '0', flex: '0 0 auto', minHeight: 42
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: 6,
        background: color.bg, color: color.text, fontSize: 13
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>
        {label}
      </span>
    </div>
    <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginLeft: 16 }}>
      {rate} <span style={{ fontSize: 11, color: '#93c5fd', fontWeight: 600 }}>{unit}</span>
    </div>
  </div>
);

const pageWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100%',
  padding: '24px 16px 48px',
};

const contentContainerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '1000px',
  display: 'flex',
  flexDirection: 'column',
  gap: '18px',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card, #1a1c29)',
  padding: '22px',
  borderRadius: 'var(--radius-lg, 16px)',
  border: '1px solid var(--border-color, #2a2d3d)',
  width: '100%',
  boxSizing: 'border-box',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  background: 'var(--bg-card-secondary, #13151f)',
  border: '1px solid var(--border-color, #2a2d3d)',
  color: '#fff',
  borderRadius: 'var(--radius-md, 8px)',
  marginTop: '8px',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-secondary, #a0a6c0)',
  display: 'block',
  fontWeight: 500,
};

const settingRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingBottom: '16px',
  borderBottom: '1px solid var(--border-color, #2a2d3d)',
  marginBottom: '16px',
};

export const Settings: React.FC = () => {
  const { logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'pricing';
  const [activeTab, setActiveTab] = useState<'pricing' | 'devices' | 'security'>(
    initialTab === 'devices' ? 'devices' : initialTab === 'security' ? 'security' : 'pricing'
  );

  // Device & Security state
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [tokenAlerts, setTokenAlerts] = useState(true);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordMsgType, setPasswordMsgType] = useState<InlineNoticeVariant>('success');

  // Pricing & Plans state
  const [balance, setBalance] = useState<number>(0);
  const [plans, setPlans] = useState<PlanVM[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionVM | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{ message: string; variant: 'success' | 'error' | 'info' } | null>(null);
  const [syncingPlan, setSyncingPlan] = useState<boolean>(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const switchTab = (tab: 'pricing' | 'devices' | 'security') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const fetchPlanData = async () => {
    try {
      const [balRes, plansRes, subRes] = await Promise.all([
        api.get('/user/wallet/balance'),
        api.get('/user/plans'),
        api.get('/user/subscription'),
      ]);
      setBalance(balRes.data.data.balance);
      setPlans(plansRes.data.data.plans);
      setSubscription(subRes.data.data.subscription);
    } catch (err) {
      console.error('Settings plan load error:', err);
    }
  };

  const handleSyncPlan = async () => {
    try {
      setSyncingPlan(true);
      setPaymentNotice(null);
      const res = await api.post('/user/checkout/verify', {});
      if (res.data.success) {
        setPaymentNotice({
          message: res.data.message || 'Successfully synchronized your subscription plan with Stripe!',
          variant: 'success'
        });
        if (res.data.data?.subscription) {
          setSubscription(res.data.data.subscription);
        }
        if (typeof res.data.data?.balance === 'number') {
          setBalance(res.data.data.balance);
        }
        await fetchPlanData();
      } else {
        setPaymentNotice({
          message: res.data.message || 'No active paid subscription found in Stripe. Plan was not updated.',
          variant: 'info'
        });
      }
    } catch (err: any) {
      setPaymentNotice({
        message: err.response?.data?.message || 'Could not verify payment status with Stripe. Please try again.',
        variant: 'error'
      });
    } finally {
      setSyncingPlan(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    try {
      setCheckoutError(null);
      setPaymentNotice(null);
      setLoadingPlan(planId);
      const res = await api.post('/user/checkout', { planId });
      window.location.href = res.data.data.checkoutUrl;
    } catch (err: any) {
      setCheckoutError(err.response?.data?.error?.message || 'Checkout failed');
      setLoadingPlan(null);
    }
  };

  useEffect(() => {
    fetchPlanData();

    // Check payment callback
    const paymentStatus = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');

    if (paymentStatus === 'success') {
      setPaymentNotice({ message: 'Verifying payment with Stripe...', variant: 'info' });
      api.post('/user/checkout/verify', { sessionId: sessionId || undefined })
        .then(async (res) => {
          if (res.data.success) {
            setPaymentNotice({
              message: res.data.message || 'Payment confirmed! Your plan is now active.',
              variant: 'success'
            });
            if (res.data.data?.subscription) {
              setSubscription(res.data.data.subscription);
            }
            if (typeof res.data.data?.balance === 'number') {
              setBalance(res.data.data.balance);
            }
            await fetchPlanData();
          } else {
            setPaymentNotice({
              message: res.data.message || 'Payment was not confirmed.',
              variant: 'error'
            });
          }
        })
        .catch((err) => {
          setPaymentNotice({
            message: err.response?.data?.message || 'Failed to verify payment status with Stripe.',
            variant: 'error'
          });
        });
    } else if (paymentStatus === 'cancelled') {
      setPaymentNotice({
        message: 'Payment process was cancelled. No changes were made to your subscription.',
        variant: 'info'
      });
    }

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');

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

  const activePlanId = subscription?.planId;

  return (
    <AppShell>
      <div className="settings-page" style={pageWrapperStyle}>
        <div style={contentContainerStyle}>

          {/* Page Header */}
          <div className="settings-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Settings & Preferences
              </h1>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                Manage your subscription plans, token rate cards, hardware defaults, and security.
              </p>
            </div>
            <div className="pill-badge settings-token-badge" style={{ borderColor: 'var(--accent-blue)', background: 'rgba(37,99,235,0.1)' }}>
              💎 {balance.toLocaleString()} Available Tokens
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="settings-tabs" style={{
            display: 'flex',
            gap: 8,
            padding: '4px',
            background: 'var(--bg-card, #1c202e)',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-color)',
            width: 'fit-content',
            maxWidth: '100%',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}>
            <button
              type="button"
              onClick={() => switchTab('pricing')}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: activeTab === 'pricing' ? 'var(--accent-blue)' : 'transparent',
                color: activeTab === 'pricing' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span>💳 Pricing & Plan Changes</span>
            </button>
            <button
              type="button"
              onClick={() => switchTab('devices')}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: activeTab === 'devices' ? 'var(--accent-blue)' : 'transparent',
                color: activeTab === 'devices' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span>⚙️ Devices & Call Defaults</span>
            </button>
            <button
              type="button"
              onClick={() => switchTab('security')}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: activeTab === 'security' ? 'var(--accent-blue)' : 'transparent',
                color: activeTab === 'security' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span>🔒 Security & Password</span>
            </button>
          </div>

          {paymentNotice && (
            <InlineNotice
              message={paymentNotice.message}
              variant={paymentNotice.variant}
              onDismiss={() => setPaymentNotice(null)}
            />
          )}

          <InlineNotice
            message={checkoutError}
            variant="error"
            onDismiss={() => setCheckoutError(null)}
          />

          {/* TAB 1: PRICING & PLAN CHANGES */}
          {activeTab === 'pricing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Active Plan Overview Card */}
              {subscription && (
                <div className="settings-active-plan" style={{
                  background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.45) 0%, rgba(20, 24, 38, 0.9) 100%)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '24px',
                  display: 'flex',
                  gap: 32,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: 1.1, fontWeight: 700 }}>Current Plan</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#93c5fd', marginTop: 2 }}>{subscription.plan.name}</div>
                    <div style={{ fontSize: 13, color: '#f1f5f9', marginTop: 3, fontWeight: 500 }}>
                      ${subscription.plan.price} / {formatBillingPeriod(subscription.plan.billingPeriod)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: 1.1, fontWeight: 700 }}>Quota Allocation</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>
                      {subscription.plan.monthlyTokenQuota.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 13, color: '#f1f5f9', marginTop: 3, fontWeight: 500 }}>Tokens / {formatBillingPeriod(subscription.plan.billingPeriod)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: 1.1, fontWeight: 700 }}>Status</div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'rgba(16,185,129,0.18)', color: '#34d399',
                      padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: 13,
                      marginTop: 4, border: '1px solid rgba(16,185,129,0.3)'
                    }}>
                      <span style={{ width: 7, height: 7, background: '#34d399', borderRadius: '50%', display: 'inline-block' }} />
                      {subscription.status}
                    </div>
                    {subscription.currentPeriodEnd && (
                      <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 6, fontWeight: 500 }}>
                        Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  
                  {/* Aesthetic 2x2 Grid for Active Subscription Rates */}
                  <div className="settings-active-rates" style={{ marginLeft: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <FeatureRateItem icon={<Icons.Video/>} label="Video Call" rate={subscription.plan.videoRatePerMinute} unit="t/min" color={{ bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' }} />
                    <FeatureRateItem icon={<Icons.Recording/>} label="Call Rec" rate={subscription.plan.recordingRatePerMinute} unit="t/min" color={{ bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' }} />
                    <FeatureRateItem icon={<Icons.Transcription/>} label="Live Transcribe" rate={subscription.plan.transcriptionRatePerMinute} unit="t/min" color={{ bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc' }} />
                    <FeatureRateItem icon={<Icons.AI/>} label="Gemini Query" rate={subscription.plan.geminiRatePerRequest} unit="t/req" color={{ bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' }} />
                  </div>
                </div>
              )}

              {/* Plans & Dynamic Rate Card Marketplace */}
              <section className="settings-card" style={cardStyle}>
                <div className="settings-card-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 700 }}>
                      Pricing & Plan Changes
                    </h2>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                      Select a plan tier below. Rates reflect token cost per minute or request based on active tier.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncPlan}
                    disabled={syncingPlan}
                    style={{
                      background: 'rgba(37, 99, 235, 0.1)',
                      border: '1px solid rgba(37, 99, 235, 0.3)',
                      color: 'var(--accent-blue)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: syncingPlan ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Icons.Refresh spinning={syncingPlan} />
                    <span>{syncingPlan ? 'Checking Stripe…' : 'Refresh Plan Status'}</span>
                  </button>
                </div>

                <div className="settings-plan-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                  {plans.map(p => {
                    const isActive = isActivePlan(p.id, activePlanId);
                    return (
                      <div
                        key={p.id}
                        className="settings-plan-card"
                        style={{
                          background: isActive ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(28, 32, 46, 0.8) 100%)' : 'var(--bg-card-secondary, #13151f)',
                          borderRadius: 'var(--radius-lg)',
                          border: isActive ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                          padding: 16,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                          position: 'relative',
                          boxShadow: isActive ? '0 8px 24px rgba(37, 99, 235, 0.15)' : 'none'
                        }}
                      >
                        {isActive && (
                          <div style={{
                            position: 'absolute', top: 8, right: 16,
                            background: 'var(--accent-blue)', color: '#fff',
                            fontSize: 11, fontWeight: 700, padding: '3px 10px',
                            borderRadius: 999, letterSpacing: 0.5,
                          }}>
                            ACTIVE PLAN
                          </div>
                        )}
                        <div style={{ fontWeight: 700, fontSize: 18, color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: 32, fontWeight: 800 }}>
                          ${p.price} <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>/ {formatBillingPeriod(p.billingPeriod)}</span>
                        </div>
                        <div style={{ color: 'var(--accent-blue)', fontWeight: 600, fontSize: 14 }}>
                          {p.monthlyTokenQuota.toLocaleString()} Tokens / {formatBillingPeriod(p.billingPeriod)}
                        </div>
                        
                        {/* Dynamic Rate Card Breakdown */}
                        <div className="settings-rate-list" style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
                          <FeatureRateItem icon={<Icons.Video/>} label="Video Call" rate={p.videoRatePerMinute} unit="t/min" color={{ bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' }} />
                          <FeatureRateItem icon={<Icons.Recording/>} label="Call Recording" rate={p.recordingRatePerMinute} unit="t/min" color={{ bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' }} />
                          <FeatureRateItem icon={<Icons.Transcription/>} label="Live Transcription" rate={p.transcriptionRatePerMinute} unit="t/min" color={{ bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' }} />
                          <FeatureRateItem icon={<Icons.AI/>} label="Gemini AI Query" rate={p.geminiRatePerRequest} unit="t/req" color={{ bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' }} />
                        </div>

                        <button
                          type="button"
                          disabled={isActive || loadingPlan === p.id}
                          onClick={() => handleSubscribe(p.id)}
                          style={{
                            marginTop: 'auto',
                            background: isActive ? 'rgba(37,99,235,0.1)' : 'var(--accent-blue)',
                            border: isActive ? '1px solid rgba(37,99,235,0.3)' : 'none',
                            color: isActive ? 'var(--accent-blue)' : '#fff',
                            padding: '12px 0',
                            borderRadius: 'var(--radius-pill)',
                            fontWeight: 600,
                            cursor: isActive ? 'default' : 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {isActive ? '✓ Current Plan' : loadingPlan === p.id ? 'Redirecting to Stripe...' : 'Change to this Plan'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: DEVICE & CALL DEFAULTS */}
          {activeTab === 'devices' && (
            <section style={cardStyle}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600 }}>Device & Call Defaults</h2>
              <p style={{ margin: '0 0 24px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                Configure default microphone, camera, and in-call token monitoring behavior.
              </p>

              <div style={settingRowStyle}>
                <div>
                  <div style={{ fontWeight: 600, color: '#fff' }}>Enable Microphone on Call Join</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary, #a0a6c0)', marginTop: 4 }}>
                    Automatically publish your audio stream upon entering video rooms
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={micActive}
                  onChange={(e) => setMicActive(e.target.checked)}
                  style={{ width: 20, height: 20, accentColor: 'var(--accent-blue, #2563eb)' }}
                />
              </div>

              <div style={settingRowStyle}>
                <div>
                  <div style={{ fontWeight: 600, color: '#fff' }}>Enable Camera on Call Join</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary, #a0a6c0)', marginTop: 4 }}>
                    Automatically publish your video stream upon entering video rooms
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={camActive}
                  onChange={(e) => setCamActive(e.target.checked)}
                  style={{ width: 20, height: 20, accentColor: 'var(--accent-blue, #2563eb)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#fff' }}>Low Token In-Call Audio Alerts</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary, #a0a6c0)', marginTop: 4 }}>
                    Play subtle alert chime when remaining token balance drops under 15
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={tokenAlerts}
                  onChange={(e) => setTokenAlerts(e.target.checked)}
                  style={{ width: 20, height: 20, accentColor: 'var(--accent-blue, #2563eb)' }}
                />
              </div>
            </section>
          )}

          {/* TAB 3: SECURITY & PASSWORD */}
          {activeTab === 'security' && (
            <section style={cardStyle}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600 }}>Security & Password</h2>
              <p style={{ margin: '0 0 24px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                Update your account password to ensure your account remains safe and secure.
              </p>
              
              <InlineNotice
                message={passwordMsg}
                variant={passwordMsgType}
                onDismiss={() => setPasswordMsg('')}
              />
              
              <form onSubmit={handleChangePassword}>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Current Password</label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                
                <div style={{ marginBottom: 24 }}>
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
                    background: 'var(--accent-blue, #2563eb)',
                    border: 'none',
                    color: '#fff',
                    padding: '12px 24px',
                    borderRadius: 'var(--radius-pill, 9999px)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                    width: 'fit-content',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Update Password
                </button>
              </form>
            </section>
          )}

          {/* Mobile-Only Sign Out Option */}
          <div className="settings-mobile-signout">
            <button
              type="button"
              onClick={logout}
              className="settings-signout-btn"
              title="Sign out of your account"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Sign Out</span>
            </button>
          </div>

        </div>
      </div>
    </AppShell>
  );
};

export default Settings;