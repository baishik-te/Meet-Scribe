import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE_URL } from '../api/client';
import { AppShell } from '../components/AppShell';
import { InlineNotice } from '../components/InlineNotice';
import { useAuth } from '../context/AuthContext';
import type {
  ActionItemVM,
  DashboardAnalyticsVM,
  KeyTopicVM,
  LedgerEntryVM,
  RecentMeetingVM,
  ScheduledCallVM
} from '../types/viewModels';
import '../styles/Dashboard.css';

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
  Calendar: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
  ),
  Play: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
  ),
  Document: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
  ),
  CheckCircle: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
  ),
  Sparkles: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>
  ),
  Plus: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
  ),
  Settings: () => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
  ),
  EmptyBox: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
  )
};

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours > 0 && diffHours < 24) {
    const hours = Math.round(diffHours);
    return `In ${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (diffHours >= 24 && diffHours < 48) {
    return 'Tomorrow';
  } else if (diffHours >= 48) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const UserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [balance, setBalance] = useState<number>(0);
  const [timeframe, setTimeframe] = useState<7 | 30>(30);
  const [analytics, setAnalytics] = useState<DashboardAnalyticsVM | null>(null);
  const [upcomingCalls, setUpcomingCalls] = useState<ScheduledCallVM[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<RecentMeetingVM[]>([]);
  const [actionItems, setActionItems] = useState<ActionItemVM[]>([]);
  const [keyTopics, setKeyTopics] = useState<KeyTopicVM[]>([]);
  const [ledger, setLedger] = useState<LedgerEntryVM[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Modals state
  const [activeRecordingModal, setActiveRecordingModal] = useState<RecentMeetingVM | null>(null);
  const [activeTranscriptModal, setActiveTranscriptModal] = useState<{ meeting: RecentMeetingVM; lines: any[] } | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingDate, setNewMeetingDate] = useState('');
  const [newMeetingAutoScribe, setNewMeetingAutoScribe] = useState(true);
  const [newActionItemText, setNewActionItemText] = useState('');

  // Fetch Dashboard Data strictly for the logged-in user
  const fetchDashboardData = async (days = timeframe) => {
    try {
      const [balRes, analyticsRes, meetingsRes, insightsRes, ledgerRes] = await Promise.all([
        api.get('/user/wallet/balance'),
        api.get(`/user/dashboard/analytics?days=${days}`),
        api.get('/user/dashboard/meetings'),
        api.get('/user/dashboard/ai-insights'),
        api.get('/user/wallet/ledger?limit=6')
      ]);

      setBalance(balRes.data.data.balance);
      setAnalytics(analyticsRes.data.data);
      setUpcomingCalls(meetingsRes.data.data.upcomingCalls || []);
      setRecentMeetings(meetingsRes.data.data.recentMeetings || []);
      setActionItems(insightsRes.data.data.actionItems || []);
      setKeyTopics(insightsRes.data.data.keyTopics || []);
      setLedger(ledgerRes.data.data.entries || []);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setNotice(err.response?.data?.error?.message || 'Could not load your dashboard analytics.');
    }
  };

  useEffect(() => {
    fetchDashboardData(timeframe);
  }, [timeframe]);

  // Actions
  const handleToggleAutoScribe = async (callId: string, current: boolean) => {
    try {
      const res = await api.patch(`/user/dashboard/scheduled-calls/${callId}/auto-scribe`, {
        autoScribe: !current
      });
      setUpcomingCalls(prev => prev.map(c => (c.id === callId ? res.data.data.call : c)));
    } catch (err) {
      console.error('Auto-scribe toggle failed:', err);
    }
  };

  const handleToggleActionItem = async (item: ActionItemVM) => {
    const nextCompleted = !item.completed;
    setActionItems(prev => prev.map(i => (i.id === item.id ? { ...i, completed: nextCompleted } : i)));

    try {
      await api.patch(`/user/dashboard/action-items/${item.id}`, {
        completed: nextCompleted,
        text: item.text,
        sourceMeeting: item.sourceMeeting,
        priority: item.priority
      });
    } catch (err) {
      // Revert if error
      setActionItems(prev => prev.map(i => (i.id === item.id ? { ...i, completed: item.completed } : i)));
    }
  };

  const handleCreateActionItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionItemText.trim()) return;

    try {
      const res = await api.post('/user/dashboard/action-items', {
        text: newActionItemText.trim(),
        sourceMeeting: 'Dashboard Quick Task',
        priority: 'MEDIUM'
      });
      setActionItems(prev => [res.data.data.item, ...prev]);
      setNewActionItemText('');
    } catch (err) {
      console.error('Failed to add action item:', err);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeetingTitle.trim() || !newMeetingDate) return;

    try {
      const res = await api.post('/user/dashboard/scheduled-calls', {
        title: newMeetingTitle.trim(),
        scheduledAt: new Date(newMeetingDate).toISOString(),
        durationMinutes: 30,
        autoScribe: newMeetingAutoScribe
      });
      setUpcomingCalls(prev => [...prev, res.data.data.call].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()));
      setShowScheduleModal(false);
      setNewMeetingTitle('');
      setNewMeetingDate('');
    } catch (err) {
      console.error('Failed to schedule meeting:', err);
    }
  };

  const openTranscriptModal = async (meeting: RecentMeetingVM) => {
    try {
      const res = await api.get(`/user/calls/${meeting.id}/transcripts`);
      setActiveTranscriptModal({
        meeting,
        lines: res.data.data.transcripts || []
      });
    } catch (err) {
      navigate('/library?tab=transcriptions');
    }
  };

  // Quota calculation values strictly from user's active status
  const planBillingPeriod = analytics?.quotaTracker.billingPeriod || 'month';
  const totalSpendable = analytics?.quotaTracker.totalSpendableTokens ?? analytics?.quotaTracker.currentBalance ?? balance;
  const consumedQuota = analytics?.quotaTracker.consumedThisCycle || 0;
  const totalQuotaLimit = totalSpendable > 0 ? totalSpendable : (analytics?.quotaTracker.monthlyLimit || 2500);
  const percentConsumed = totalQuotaLimit > 0
    ? Math.min(100, Math.round((consumedQuota / totalQuotaLimit) * 100))
    : 0;
  const daysRemaining = analytics?.quotaTracker.daysRemaining ?? 0;

  // Breakdown strictly from user's actual ledger transactions
  const breakdown = analytics?.breakdown || {
    videoCalls: 0,
    callRecordings: 0,
    liveTranscriptions: 0,
    geminiQueries: 0,
    totalSpent: 0
  };

  const totalSpent = breakdown.totalSpent;
  const hasUsage = totalSpent > 0;

  const segments = [
    { label: 'Video Calls', amount: breakdown.videoCalls, color: '#3b82f6', icon: <Icons.Video /> },
    { label: 'Call Recordings', amount: breakdown.callRecordings, color: '#ef4444', icon: <Icons.Recording /> },
    { label: 'Live Transcriptions', amount: breakdown.liveTranscriptions, color: '#a855f7', icon: <Icons.Transcription /> },
    { label: 'Gemini AI Queries', amount: breakdown.geminiQueries, color: '#10b981', icon: <Icons.AI /> },
  ];

  // SVG donut math
  let cumulativeAngle = 0;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;

  // Daily series strictly from user's actual usage
  const dailySeries = analytics?.dailySeries || [];
  const maxDayTotal = Math.max(0, ...dailySeries.map(d => d.total));
  const hasDailyActivity = maxDayTotal > 0;

  const completedActionItemsCount = actionItems.filter(i => i.completed).length;

  return (
    <AppShell
      title={`Welcome back, ${user?.name ?? ''}`}
      headerRight={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => navigate('/settings?tab=pricing')}
            style={{
              background: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              color: 'var(--accent-blue)',
              borderRadius: 'var(--radius-pill)',
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Icons.Settings />
            <span>Settings</span>
          </button>
          <div className="pill-badge" style={{ borderColor: 'var(--accent-blue)' }}>
            💎 {totalSpendable.toLocaleString()} Tokens
          </div>
        </div>
      }
    >
      <div className="dashboard-container">

        {notice && (
          <InlineNotice message={notice} variant="info" onDismiss={() => setNotice(null)} />
        )}

        {/* ── 1. QUOTA TRACKER HERO BANNER ── */}
        <section className="quota-hero-banner">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                {planBillingPeriod === '3_months'
                  ? '3-Month Quota Tracker'
                  : planBillingPeriod === '6_months'
                    ? '6-Month Quota Tracker'
                    : planBillingPeriod === 'year'
                      ? 'Annual Quota Tracker'
                      : 'Monthly Quota Tracker'}
              </span>
              <span style={{
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999
              }}>
                {analytics?.quotaTracker.planName || 'Active Plan'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#fff' }}>
                {consumedQuota.toLocaleString()} <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 500 }}>/ {totalQuotaLimit.toLocaleString()} Tokens Used</span>
              </h2>
              <span style={{ fontSize: 15, fontWeight: 700, color: percentConsumed > 85 ? '#f87171' : '#34d399' }}>
                ({percentConsumed}% consumed)
              </span>
            </div>

            {/* Glowing Progress Track */}
            <div className="quota-progress-track">
              <div
                className="quota-progress-fill"
                style={{
                  width: `${percentConsumed}%`,
                  background: percentConsumed > 85
                    ? 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)'
                    : 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 70%, #10b981 100%)'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#94a3b8', flexWrap: 'wrap', gap: 8 }}>
              <span>
                🗓 <strong>{daysRemaining} days</strong> remaining in this cycle
                {analytics?.quotaTracker.currentPeriodEnd && ` (renews ${new Date(analytics.quotaTracker.currentPeriodEnd).toLocaleDateString()})`}
              </span>
              <span>
                💎 <strong>{totalSpendable.toLocaleString()}</strong> total tokens available for spending
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
            <button
              type="button"
              onClick={() => navigate('/settings?tab=pricing')}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                padding: '10px 20px',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                whiteSpace: 'nowrap'
              }}
            >
              <span>Change Plan & View Rates</span>
              <span>→</span>
            </button>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              Manage billing tiers under Settings
            </span>
          </div>
        </section>


        {/* ── 2. KEY PERFORMANCE & TOKEN USAGE ANALYTICS ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                Key Performance & Usage Analytics
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                Real-time breakdown of your token expenditure across Video Calls, Call Recordings, Live Transcriptions, and Gemini AI Queries.
              </p>
            </div>

            {/* Timeframe switch */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-pill)',
              padding: '3px'
            }}>
              <button
                type="button"
                onClick={() => setTimeframe(7)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: timeframe === 7 ? 'var(--accent-blue)' : 'transparent',
                  color: timeframe === 7 ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Past 7 Days
              </button>
              <button
                type="button"
                onClick={() => setTimeframe(30)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: timeframe === 30 ? 'var(--accent-blue)' : 'transparent',
                  color: timeframe === 30 ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Past 30 Days
              </button>
            </div>
          </div>

          <div className="analytics-grid">

            {/* Visualizer: Donut Breakdown */}
            <div className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h4 className="dash-card-title">
                    <span>Token Usage Visualizer</span>
                  </h4>
                  <p className="dash-card-subtitle">
                    Distribution of consumed tokens in the past {timeframe} days
                  </p>
                </div>
              </div>

              {!hasUsage ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '32px 16px',
                  textAlign: 'center',
                  gap: 12
                }}>
                  <div className="donut-svg-wrapper" style={{ width: 140, height: 140 }}>
                    <svg width="140" height="140" viewBox="0 0 140 140">
                      <circle cx="70" cy="70" r="54" fill="transparent" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="14" strokeDasharray="4 4" />
                    </svg>
                    <div className="donut-center-text">
                      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)' }}>0</span>
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tokens</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>No token usage recorded yet</div>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 360 }}>
                      You haven't spent tokens in the past {timeframe} days. Token deductions from live video calls, recordings, transcriptions, and Gemini AI queries will automatically populate this graph.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="donut-container">
                  <div className="donut-svg-wrapper">
                    <svg width="170" height="170" viewBox="0 0 170 170" style={{ transform: 'rotate(-90deg)' }}>
                      <circle
                        cx="85"
                        cy="85"
                        r={radius}
                        fill="transparent"
                        stroke="rgba(255, 255, 255, 0.05)"
                        strokeWidth="20"
                      />
                      {segments.map((seg, idx) => {
                        if (seg.amount <= 0) return null;
                        const share = seg.amount / totalSpent;
                        const strokeDasharray = `${share * circumference} ${circumference}`;
                        const strokeDashoffset = -cumulativeAngle;
                        cumulativeAngle += share * circumference;

                        return (
                          <circle
                            key={idx}
                            cx="85"
                            cy="85"
                            r={radius}
                            fill="transparent"
                            stroke={seg.color}
                            strokeWidth="20"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            style={{ transition: 'all 0.6s ease' }}
                          />
                        );
                      })}
                    </svg>
                    <div className="donut-center-text">
                      <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
                        {totalSpent.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Tokens Spent
                      </span>
                    </div>
                  </div>

                  <div className="donut-legend">
                    {segments.map((seg, idx) => {
                      const percentage = totalSpent > 0 ? Math.round((seg.amount / totalSpent) * 100) : 0;
                      return (
                        <div key={idx} className="legend-item">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color }} />
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{seg.label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ color: '#fff' }}>{seg.amount.toLocaleString()}</strong>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Daily Consumption Velocity Bar Chart */}
            <div className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h4 className="dash-card-title">
                    <span>Consumption Velocity</span>
                  </h4>
                  <p className="dash-card-subtitle">
                    Daily token usage pattern across the past {timeframe} days
                  </p>
                </div>
                {hasDailyActivity && (
                  <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>
                    Peak: {maxDayTotal} tokens/day
                  </div>
                )}
              </div>

              {!hasDailyActivity ? (
                <div style={{
                  height: 180,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: 16
                }}>
                  <Icons.EmptyBox />
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: 14, marginTop: 8 }}>
                    No daily activity in this timeframe
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 320 }}>
                    When you participate in calls or perform AI operations, daily velocity bars will measure and visualize your activity over time.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bar-chart-bars">
                    {dailySeries.slice(-14).map((day, idx) => {
                      const heightPercent = maxDayTotal > 0
                        ? Math.max(8, Math.min(100, Math.round((day.total / maxDayTotal) * 100)))
                        : 0;
                      return (
                        <div key={idx} className="bar-col" title={`${day.label}: ${day.total} tokens spent`}>
                          <div
                            className="bar-pill"
                            style={{
                              height: `${heightPercent}%`,
                              background: day.total > 0
                                ? 'linear-gradient(180deg, #3b82f6 0%, rgba(59, 130, 246, 0.4) 100%)'
                                : 'rgba(255, 255, 255, 0.05)'
                            }}
                          />
                          <span className="bar-label">{day.label.split(' ')[1] || day.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>Showing your recorded daily burn rate</span>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>✦ Real-time ledger verified</span>
                  </div>
                </>
              )}
            </div>

          </div>
        </section>


        {/* ── 3. UPCOMING & RECENT MEETINGS ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                Upcoming & Recent Meetings
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                Access scheduled video calls, configure live Auto-Scribe, and play or review transcripts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowScheduleModal(true)}
              style={{
                background: 'rgba(37, 99, 235, 0.1)',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                color: 'var(--accent-blue)',
                borderRadius: 'var(--radius-pill)',
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Icons.Plus />
              <span>Schedule Call</span>
            </button>
          </div>

          <div className="analytics-grid">

            {/* Upcoming Scheduled Calls */}
            <div className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h4 className="dash-card-title">
                    <Icons.Calendar />
                    <span>Upcoming Scheduled Calls</span>
                  </h4>
                  <p className="dash-card-subtitle">
                    Calendar events with one-click entry and live Auto-Scribe controls
                  </p>
                </div>
                {upcomingCalls.length > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.04)', padding: '2px 8px', borderRadius: 999 }}>
                    {upcomingCalls.length} calls
                  </span>
                )}
              </div>

              {upcomingCalls.length === 0 ? (
                <div style={{
                  padding: '36px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.01)',
                  borderRadius: '12px',
                  border: '1px dashed var(--border-color)'
                }}>
                  <Icons.EmptyBox />
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: 14, marginTop: 10 }}>
                    No upcoming calls scheduled
                  </div>
                  <p style={{ margin: '4px 0 16px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 300 }}>
                    You have no scheduled meetings on your calendar. Click below to schedule a meeting with automated transcription.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    style={{
                      background: 'var(--accent-blue)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: 'var(--radius-pill)',
                      padding: '6px 16px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    + Schedule Your First Call
                  </button>
                </div>
              ) : (
                <div className="dash-scroll-list">
                  {upcomingCalls.map((call) => (
                    <div key={call.id} className="meeting-item-card">
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div className="meeting-item-title">
                          <span>{call.title}</span>
                        </div>
                        <div className="meeting-item-time">
                          <span>🗓 {formatRelativeTime(call.scheduledAt)}</span>
                          <span>⏱ {call.durationMinutes} mins</span>
                          <span>👥 {Array.isArray(call.participants) && call.participants.length > 0 ? call.participants.join(', ') : 'Direct Call'}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {/* Auto-Scribe Switch */}
                        <button
                          type="button"
                          onClick={() => handleToggleAutoScribe(call.id, call.autoScribe)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-pill)',
                            border: call.autoScribe ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid var(--border-color)',
                            background: call.autoScribe ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                            color: call.autoScribe ? '#c084fc' : 'var(--text-secondary)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title="Toggle automated live transcription on join"
                        >
                          <span>🎙 Auto-Scribe: {call.autoScribe ? 'ON' : 'OFF'}</span>
                        </button>

                        {/* Join Call */}
                        <button
                          type="button"
                          onClick={() => navigate(`/call/room?room=${encodeURIComponent(call.roomName)}`)}
                          style={{
                            background: 'var(--accent-blue)',
                            border: 'none',
                            color: '#fff',
                            borderRadius: 'var(--radius-pill)',
                            padding: '6px 14px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5
                          }}
                        >
                          <Icons.Play />
                          <span>Join Call</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Transcriptions & Recordings Cards */}
            <div className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h4 className="dash-card-title">
                    <Icons.Document />
                    <span>Recent Transcriptions & Recordings</span>
                  </h4>
                  <p className="dash-card-subtitle">
                    Completed meetings with 1-click audio playback and transcript access
                  </p>
                </div>
                {recentMeetings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/library')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-blue)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    View All in Library →
                  </button>
                )}
              </div>

              {recentMeetings.length === 0 ? (
                <div style={{
                  padding: '36px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.01)',
                  borderRadius: '12px',
                  border: '1px dashed var(--border-color)'
                }}>
                  <Icons.EmptyBox />
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: 14, marginTop: 10 }}>
                    No meeting recordings or transcriptions yet
                  </div>
                  <p style={{ margin: '4px 0 16px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 300 }}>
                    You haven't participated in any recorded or transcribed calls yet. Start a call with a connection to record audio and capture live speech.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/meetings')}
                    style={{
                      background: 'rgba(37, 99, 235, 0.1)',
                      border: '1px solid rgba(37, 99, 235, 0.3)',
                      color: 'var(--accent-blue)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '6px 16px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Start a Call from Meetings →
                  </button>
                </div>
              ) : (
                <div className="dash-scroll-list">
                  {recentMeetings.map((meeting) => (
                    <div key={meeting.id} className="recent-meeting-row">
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#fff', marginBottom: 2 }}>
                          {meeting.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span>🗓 {new Date(meeting.date).toLocaleDateString()}</span>
                          <span>⏱ {formatDuration(meeting.durationSeconds)}</span>
                          {meeting.partner && (
                            <span style={{ color: '#94a3b8' }}>
                              With {meeting.partner.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => openTranscriptModal(meeting)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'rgba(255, 255, 255, 0.04)',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5
                          }}
                        >
                          <Icons.Document />
                          <span>Transcript</span>
                        </button>

                        {meeting.hasRecording && (
                          <button
                            type="button"
                            onClick={() => setActiveRecordingModal(meeting)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid rgba(37, 99, 235, 0.4)',
                              background: 'rgba(37, 99, 235, 0.15)',
                              color: '#60a5fa',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                          >
                            <Icons.Play />
                            <span>Play Audio</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </section>


        {/* ── 4. AI INSIGHTS & SUMMARIES WIDGET ── */}
        <section>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
              AI Insights & Summaries Widget
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              Actionable tasks automatically extracted by Gemini from your recent meetings alongside trending semantic topics.
            </p>
          </div>

          <div className="analytics-grid">

            {/* AI Action Items & Next Steps */}
            <div className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h4 className="dash-card-title">
                    <Icons.CheckCircle />
                    <span>AI Action Items & Next Steps</span>
                  </h4>
                  <p className="dash-card-subtitle">
                    Automated checklist synthesized from your meeting summaries
                  </p>
                </div>
                {actionItems.length > 0 && (
                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#34d399',
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: '3px 10px',
                    borderRadius: 999
                  }}>
                    {completedActionItemsCount} / {actionItems.length} Done
                  </span>
                )}
              </div>

              {actionItems.length === 0 ? (
                <div style={{
                  padding: '24px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.01)',
                  borderRadius: '12px',
                  border: '1px dashed var(--border-color)',
                  marginBottom: 16
                }}>
                  <Icons.EmptyBox />
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: 14, marginTop: 10 }}>
                    No action items recorded yet
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 320 }}>
                    When you generate meeting summaries with Gemini, follow-up decisions and tasks will automatically be extracted here. You can also add tasks manually below.
                  </p>
                </div>
              ) : (
                <div className="dash-scroll-list" style={{ marginBottom: 16 }}>
                  {actionItems.map((item) => (
                    <div key={item.id} className="action-item-row">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleActionItem(item)}
                        className="action-item-checkbox"
                      />
                      <div style={{ flex: 1 }}>
                        <div className={`action-item-text ${item.completed ? 'completed' : ''}`}>
                          {item.text}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 10 }}>
                          <span>📂 {item.sourceMeeting || 'Recent Call'}</span>
                          <span style={{
                            color: item.priority === 'HIGH' ? '#f87171' : item.priority === 'MEDIUM' ? '#fbbf24' : '#60a5fa',
                            fontWeight: 600
                          }}>
                            ● {item.priority} Priority
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Add Action Item */}
              <form onSubmit={handleCreateActionItem} style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <input
                  type="text"
                  placeholder="Add quick custom action item..."
                  value={newActionItemText}
                  onChange={(e) => setNewActionItemText(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'var(--bg-card-secondary, #252b3d)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: 13
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: 'var(--accent-blue)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Add
                </button>
              </form>
            </div>

            {/* Key Topics / Mind Map */}
            <div className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h4 className="dash-card-title">
                    <Icons.Sparkles />
                    <span>Key Topics / Mind Map</span>
                  </h4>
                  <p className="dash-card-subtitle">
                    Recurring themes, keywords, and sentiment tags extracted from calls
                  </p>
                </div>
                {keyTopics.length > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.04)', padding: '2px 8px', borderRadius: 999 }}>
                    {keyTopics.length} topics
                  </span>
                )}
              </div>

              {keyTopics.length === 0 ? (
                <div style={{
                  padding: '36px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.01)',
                  borderRadius: '12px',
                  border: '1px dashed var(--border-color)'
                }}>
                  <Icons.EmptyBox />
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: 14, marginTop: 10 }}>
                    No trending topics detected
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 320 }}>
                    Hold calls with live transcription or generate an AI meeting summary in your Library to automatically uncover recurring semantic topics and sentiment classification.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="dash-scroll-list">
                    {keyTopics.map((topic, idx) => {
                      const sentimentClass = topic.sentiment;
                      const iconSymbol = topic.sentiment === 'positive' ? '✦' : topic.sentiment === 'urgent' ? '⚡' : '◈';
                      return (
                        <div key={idx} className="topic-card-item">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 160 }}>
                            <div className={`topic-pill ${sentimentClass}`} style={{ padding: '4px 10px', fontSize: 12 }}>
                              <span>{iconSymbol}</span>
                              <span style={{ fontWeight: 600 }}>{topic.topic}</span>
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {(topic as any).description || 'Discussion point from recent meeting'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-secondary)',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: 11,
                              fontWeight: 500
                            }}>
                              {topic.category || 'Topic'}
                            </span>
                            <span style={{
                              background: 'rgba(37, 99, 235, 0.15)',
                              color: '#60a5fa',
                              borderRadius: 999,
                              padding: '2px 8px',
                              fontSize: 11,
                              fontWeight: 700
                            }}>
                              {topic.count} mentions
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    marginTop: 'auto'
                  }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ● Positive
                      </span>
                      <span style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ● Neutral
                      </span>
                      <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ● Urgent
                      </span>
                    </div>
                    <span>Parsed from Gemini summaries</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </section>


        {/* ── 5. RECENT TOKEN LEDGER AUDIT ── */}
        <section className="dash-card">
          <div className="dash-card-header">
            <div>
              <h4 className="dash-card-title">Recent Token Ledger Events</h4>
              <p className="dash-card-subtitle">Transparent record of in-call consumption and credit top-ups</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/settings?tab=pricing')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-blue)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Subscription Plans & Rates →
            </button>
          </div>

          {ledger.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
              No token transactions recorded yet.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-color)', fontSize: 13 }}>
                  <th style={{ padding: '10px 12px' }}>Date</th>
                  <th style={{ padding: '10px 12px' }}>Event Type</th>
                  <th style={{ padding: '10px 12px' }}>Token Change</th>
                  <th style={{ padding: '10px 12px' }}>Balance After</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: 13 }}>
                    <td style={{ padding: '10px 12px', color: '#fff' }}>
                      {new Date(e.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                      {e.transactionType}
                    </td>
                    <td style={{ padding: '10px 12px', color: e.amount > 0 ? '#10b981' : 'var(--accent-red)', fontWeight: 700 }}>
                      {e.amount > 0 ? `+${e.amount}` : e.amount}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#fff' }}>
                      {e.balanceAfter?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

      </div>


      {/* ── MODAL: STREAM RECORDING / PLAY AUDIO ── */}
      {activeRecordingModal && (
        <div className="dash-modal-backdrop" onClick={() => setActiveRecordingModal(null)}>
          <div className="dash-modal-window" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>
                Playing: {activeRecordingModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setActiveRecordingModal(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <video
              src={`${API_BASE_URL}/user/recordings/${activeRecordingModal.recordingId}/file?token=${encodeURIComponent(localStorage.getItem('token') || '')}`}
              controls
              autoPlay
              playsInline
              style={{ width: '100%', maxHeight: '420px', borderRadius: '12px', background: '#000' }}
            />
          </div>
        </div>
      )}


      {/* ── MODAL: VIEW TRANSCRIPT ── */}
      {activeTranscriptModal && (
        <div className="dash-modal-backdrop" onClick={() => setActiveTranscriptModal(null)}>
          <div className="dash-modal-window" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>
                  {activeTranscriptModal.meeting.title}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Recorded on {new Date(activeTranscriptModal.meeting.date).toLocaleDateString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTranscriptModal(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 6 }}>
              {activeTranscriptModal.lines.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No transcription lines recorded for this call.</p>
              ) : (
                activeTranscriptModal.lines.map((l: any) => (
                  <div key={l.id} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, marginBottom: 2 }}>
                      {l.speaker?.name || 'Speaker'} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>• {new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#fff' }}>{l.text}</div>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => navigate('/library?tab=transcriptions')}
                style={{
                  background: 'var(--accent-blue)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 'var(--radius-pill)',
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Open in Full Library
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── MODAL: SCHEDULE NEW CALL ── */}
      {showScheduleModal && (
        <div className="dash-modal-backdrop" onClick={() => setShowScheduleModal(false)}>
          <div className="dash-modal-window" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>
                Schedule Upcoming Call
              </h3>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Meeting Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Client Architecture Review"
                  value={newMeetingTitle}
                  onChange={(e) => setNewMeetingTitle(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-card-secondary, #252b3d)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Scheduled Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newMeetingDate}
                  onChange={(e) => setNewMeetingDate(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-card-secondary, #252b3d)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <input
                  type="checkbox"
                  id="autoScribeCheck"
                  checked={newMeetingAutoScribe}
                  onChange={(e) => setNewMeetingAutoScribe(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--accent-blue)' }}
                />
                <label htmlFor="autoScribeCheck" style={{ fontSize: 13, color: '#fff', cursor: 'pointer' }}>
                  Enable Auto-Scribe live transcription by default
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '8px 16px',
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: 'var(--accent-blue)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: 'var(--radius-pill)',
                    padding: '8px 20px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Save Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AppShell>
  );
};

export default UserDashboard;