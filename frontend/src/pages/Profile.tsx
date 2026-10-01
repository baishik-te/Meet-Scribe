import React, { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { AppShell } from '../components/AppShell';
import { InlineNotice } from '../components/InlineNotice';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { useAuth } from '../context/AuthContext';
import { isActivePlan, formatBillingPeriod } from '../lib/planSelection';
import type { PlanVM, SubscriptionVM } from '../types/viewModels';
import '../styles/profile.css';

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
  )
};

// --- Reusable Styled Rate Item ---
const FeatureRateItem = ({ icon, label, rate, unit, color }: { icon: React.ReactNode, label: string, rate: number, unit: string, color: { bg: string, text: string } }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', background: 'rgba(148, 163, 184, 0.05)',
    borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.1)',
    minWidth: '200px'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 8,
        background: color.bg, color: color.text, fontSize: 16
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
        {label}
      </span>
    </div>
    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 16 }}>
      {rate} <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{unit}</span>
    </div>
  </div>
);

interface ProfileDetails {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status?: string;
  emailVerified?: boolean;
  createdAt?: string;
  avatarUrl?: string | null;
}

export const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [balance, setBalance] = useState<number>(0);
  const [subscription, setSubscription] = useState<SubscriptionVM | null>(null);
  const [plans, setPlans] = useState<PlanVM[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // ── Account details (GET/PATCH /user/profile, POST /user/avatar) ──
  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [editing, setEditing] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
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
      const details: ProfileDetails = res.data.data.user;
      setProfile(details);
      setAccountName(details?.name ?? '');
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

  const handleSaveAccount = async () => {
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
      setProfile((prev) => (prev ? { ...prev, name: updated?.name ?? accountName.trim() } : prev));
      setAccountName(updated?.name ?? accountName.trim());
      setEditing(false);
      setAccountSuccess('Profile updated.');
      setTimeout(() => setAccountSuccess(null), 4000);
      void refreshUser();
    } catch (err: any) {
      setAccountError(err.response?.data?.error?.message || 'Failed to update profile');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (avatarUploading) return;
    setAccountError(null);
    try {
      setAvatarUploading(true);
      const form = new FormData();
      form.append('avatar', file);
      const res = await api.post('/user/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updated = res.data.data.user;
      setProfile((prev) => (prev ? { ...prev, avatarUrl: updated?.avatarUrl ?? null } : prev));
      await refreshUser();
      setAccountSuccess('Profile photo updated.');
      setTimeout(() => setAccountSuccess(null), 4000);
    } catch (err: any) {
      setAccountError(err.response?.data?.error?.message || 'Failed to upload photo');
    } finally {
      setAvatarUploading(false);
    }
  };

  const displayName = profile?.name ?? user?.name ?? '';
  const displayEmail = profile?.email ?? user?.email ?? '';
  const emailVerified = profile?.emailVerified ?? user?.emailVerified ?? false;
  const avatarUrl = profile?.avatarUrl ?? user?.avatarUrl ?? null;
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  const activePlanId = subscription?.planId;

  return (
    <AppShell>
      <div className="profile-page">

        {/* ── Success toast ── */}
        {successMsg && (
          <InlineNotice
            message={successMsg}
            variant="success"
          />
        )}

        {/* ── Hero: avatar, name + verified badge, email ── */}
        <section className="profile-hero">
          <ProfileAvatar
            user={{ name: displayName, avatarUrl }}
            size={104}
            editable
            onUpload={handleAvatarUpload}
          />
          <div className="profile-hero__identity">
            <div className="profile-hero__name-row">
              <h1 className="profile-hero__name">{displayName}</h1>
              {emailVerified && <VerifiedBadge size={20} />}
            </div>
            <p className="profile-hero__email">{displayEmail}</p>
          </div>
        </section>

        {/* ── Personal details ── */}
        <section className="profile-card">
          <header className="profile-card__header">
            <h2 className="profile-card__title">Personal details</h2>
            <div className="profile-header-actions">
              {editing ? (
                <>
                  <button
                    type="button"
                    className="profile-btn profile-btn--ghost"
                    disabled={savingAccount}
                    onClick={() => {
                      setEditing(false);
                      setAccountName(profile?.name ?? '');
                      setAccountError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="profile-btn profile-btn--primary"
                    disabled={savingAccount}
                    onClick={handleSaveAccount}
                  >
                    {savingAccount ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="profile-btn profile-btn--ghost"
                  onClick={() => {
                    setAccountName(profile?.name ?? '');
                    setEditing(true);
                  }}
                >
                  Edit
                </button>
              )}
            </div>
          </header>

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

          <dl className="profile-details">
            <div className="profile-details-row">
              <dt>Full name</dt>
              <dd>
                {editing ? (
                  <input
                    id="account-name"
                    className="profile-input"
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Your name"
                  />
                ) : (
                  displayName
                )}
              </dd>
            </div>
            <div className="profile-details-row">
              <dt>Email</dt>
              <dd>
                {displayEmail}
                <span className="profile-details__note">cannot be changed here</span>
              </dd>
            </div>
            <div className="profile-details-row">
              <dt>Role</dt>
              <dd>{profile?.role === 'ADMIN' ? 'Administrator' : 'Member'}</dd>
            </div>
            <div className="profile-details-row">
              <dt>Status</dt>
              <dd>
                <span
                  className={`profile-status-pill ${profile?.status === 'ACTIVE' ? 'profile-status-pill--active' : 'profile-status-pill--muted'
                    }`}
                >
                  <span className="profile-status-pill__dot" />
                  {profile?.status ?? '—'}
                </span>
              </dd>
            </div>
            <div className="profile-details-row">
              <dt>Member since</dt>
              <dd>{memberSince}</dd>
            </div>
          </dl>
        </section>

        {/* ── Current plan ── */}
        <section className="profile-card">
          <header className="profile-card__header">
            <h2 className="profile-card__title">Current Plan</h2>
            {loading && <span className="profile-card__hint">refreshing…</span>}
          </header>
          <div className="profile-card__body">
            <div className="plan-card__top">
              <div>
                <div className="plan-card__name">{subscription?.plan?.name ?? 'Free Tier'}</div>
                {subscription?.plan && (
                  <div className="plan-card__meta">
                    ${subscription.plan.price}/{formatBillingPeriod(subscription.plan.billingPeriod)} · renews{' '}
                    {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : '—'}
                  </div>
                )}
              </div>

              <div className="plan-card__stats">
                <div className="plan-card__stat">
                  <div className="plan-card__stat-label">Token Balance</div>
                  <div className="plan-card__stat-value">{balance.toLocaleString()}</div>
                  {subscription?.plan && (
                    <div className="plan-card__stat-sub">
                      {subscription.plan.monthlyTokenQuota.toLocaleString()} / mo
                    </div>
                  )}
                </div>

                <div className="plan-card__stat">
                  <div className="plan-card__stat-label">Status</div>
                  <span
                    className={`profile-status-pill ${subscription ? 'profile-status-pill--active' : 'profile-status-pill--muted'
                      }`}
                  >
                    <span className="profile-status-pill__dot" />
                    {subscription?.status ?? 'NO PLAN'}
                  </span>
                </div>
              </div>
            </div>

            {/* Aesthetic Grid for Rates */}
            {subscription?.plan && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 16,
                marginTop: 28,
                paddingTop: 24,
                borderTop: '1px solid var(--border-color)'
              }}>
                <FeatureRateItem icon={<Icons.Video />} label="Video Call" rate={subscription.plan.videoRatePerMinute} unit="t/min" color={{ bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' }} />
                <FeatureRateItem icon={<Icons.Recording />} label="Call Rec" rate={subscription.plan.recordingRatePerMinute} unit="t/min" color={{ bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' }} />
                <FeatureRateItem icon={<Icons.Transcription />} label="Live Transcribe" rate={subscription.plan.transcriptionRatePerMinute} unit="t/min" color={{ bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' }} />
                <FeatureRateItem icon={<Icons.AI />} label="Gemini Query" rate={subscription.plan.geminiRatePerRequest} unit="t/req" color={{ bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' }} />
              </div>
            )}
          </div>
        </section>

        {/* ── Change plan ── */}
        <section className="profile-card">
          <header className="profile-card__header">
            <h2 className="profile-card__title">{subscription ? 'Change Plan' : 'Choose a Plan'}</h2>
          </header>
          <div className="profile-card__body">
            <InlineNotice
              message={checkoutError}
              variant="error"
              onDismiss={() => setCheckoutError(null)}
            />
            <div className="tier-grid">
              {plans.map((p) => {
                const isActive = isActivePlan(p.id, activePlanId);
                return (
                  <article key={p.id} className={`tier-card${isActive ? ' tier-card--active' : ''}`}>
                    {isActive && <span className="tier-card__tag">ACTIVE</span>}
                    <div className="tier-card__name">{p.name}</div>
                    <div className="tier-card__price">${p.price}/{formatBillingPeriod(p.billingPeriod)}</div>
                    <div className="tier-card__quota">{p.monthlyTokenQuota.toLocaleString()} Tokens/{formatBillingPeriod(p.billingPeriod)}</div>
                    <button
                      type="button"
                      disabled={isActive || loadingPlan === p.id}
                      onClick={() => handleUpgrade(p.id)}
                      className={`profile-btn tier-card__btn ${isActive ? 'tier-card__btn--current' : 'profile-btn--primary'
                        }`}
                    >
                      {isActive ? '✓ Current Plan' : loadingPlan === p.id ? 'Redirecting...' : 'Switch to Plan'}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

      </div>
    </AppShell>
  );
};