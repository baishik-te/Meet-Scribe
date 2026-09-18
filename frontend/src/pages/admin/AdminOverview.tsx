import React, { useEffect, useState } from 'react';
import api from '../../api/client';

export const AdminOverview: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [ledgerCount, setLedgerCount] = useState<number>(0);
  const [callsCount, setCallsCount] = useState<number>(0);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [usersRes, plansRes, ledgerRes, callsRes] = await Promise.all([
          api.get('/admin/users'),
          api.get('/user/plans'),
          api.get('/admin/ledger?limit=1'),
          api.get('/admin/calls')
        ]);
        setUsers(usersRes.data.data.users);
        setPlans(plansRes.data.data.plans);
        setLedgerCount(ledgerRes.data.data.total || 0);
        setCallsCount(callsRes.data.data.calls.length || 0);
      } catch (err) {
        console.error('Error fetching admin metrics', err);
      }
    };
    fetchMetrics();
  }, []);

  const totalTokensInCirculation = users.reduce((acc, u) => acc + (u.wallet?.currentTokenBalance || 0), 0);

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Registered Accounts</span>
          <span className="kpi-value">{users.length}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Tokens in Circulation</span>
          <span className="kpi-value" style={{ color: 'var(--accent-blue)' }}>
            {totalTokensInCirculation.toLocaleString()}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Active Plans</span>
          <span className="kpi-value">{plans.length}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Total Calls Logged</span>
          <span className="kpi-value">{callsCount}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Audited Transactions</span>
          <span className="kpi-value">{ledgerCount}</span>
        </div>
      </div>

      <div className="admin-card">
        <h3 className="admin-card-header">Platform Summary</h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          All paid operations deduct tokens from the centralized token ledger. PostgreSQL maintains ledger authority with row locking, while Stripe synchronizes product and subscription state. Use the navigation menu in the left sidebar to manage rate cards, inspect calls, or execute manual balance adjustments.
        </p>
      </div>
    </div>
  );
};