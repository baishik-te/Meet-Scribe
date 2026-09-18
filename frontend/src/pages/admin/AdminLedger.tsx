import React, { useEffect, useState } from 'react';
import api from '../../api/client';

export const AdminLedger: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [adjustData, setAdjustData] = useState({ userId: '', amount: 0, reason: '' });
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      const [usersRes, ledgerRes] = await Promise.all([
        api.get('/admin/users'),
        api.get(`/admin/ledger?page=${page}&limit=15`)
      ]);
      setUsers(usersRes.data.data.users);
      setLedgerEntries(ledgerRes.data.data.entries);
      setTotal(ledgerRes.data.data.total);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustData.userId || adjustData.amount === 0) {
      alert('Please select a user and provide a non-zero token amount.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/admin/adjust-tokens', adjustData);
      alert('Token adjustment executed and audit record written.');
      setAdjustData({ userId: '', amount: 0, reason: '' });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Adjustment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="admin-card">
        <h3 className="admin-card-header">Manual Token Balance Adjustment</h3>
        <form onSubmit={handleAdjust}>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Target User</label>
              <select
                required
                value={adjustData.userId}
                onChange={e => setAdjustData({ ...adjustData, userId: e.target.value })}
                className="dark-select"
              >
                <option value="">Select a user account...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) — Balance: {u.wallet?.currentTokenBalance ?? 0}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Delta Amount (Positive/Negative)</label>
              <input
                required
                type="number"
                value={adjustData.amount}
                onChange={e => setAdjustData({ ...adjustData, amount: Number(e.target.value) })}
                className="dark-input"
                placeholder="+500 or -200"
              />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 3' }}>
              <label>Audit Reason</label>
              <input
                required
                type="text"
                value={adjustData.reason}
                onChange={e => setAdjustData({ ...adjustData, reason: e.target.value })}
                className="dark-input"
                placeholder="Reason for manual adjustment"
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="admin-btn admin-btn-warning">
            {loading ? 'Executing Lock & Debit...' : 'Execute Balance Adjustment'}
          </button>
        </form>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <span>Global Token Ledger ({total} events)</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="admin-btn"
              style={{ padding: '6px 14px', fontSize: 12 }}
            >
              Previous
            </button>
            <button
              disabled={page * 15 >= total}
              onClick={() => setPage(p => p + 1)}
              className="admin-btn"
              style={{ padding: '6px 14px', fontSize: 12 }}
            >
              Next
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Account</th>
                <th>Transaction Type</th>
                <th>Change</th>
                <th>Balance After</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map(e => (
                <tr key={e.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td>{e.user?.name || e.userId}</td>
                  <td>
                    <span className="pill-badge" style={{ fontSize: 11, display: 'inline-block' }}>
                      {e.transactionType}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: e.amount > 0 ? '#10b981' : 'var(--accent-red)' }}>
                    {e.amount > 0 ? `+${e.amount}` : e.amount}
                  </td>
                  <td style={{ fontWeight: 600 }}>{e.balanceAfter}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {e.featureReference || e.referenceId || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};