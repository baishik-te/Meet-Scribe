import React, { useEffect, useState } from 'react';
import api from '../api/client';

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [newPlan, setNewPlan] = useState({
    name: '',
    price: 10,
    monthlyTokenQuota: 1000,
    videoRatePerMinute: 2,
    recordingRatePerMinute: 1,
    transcriptionRatePerMinute: 1,
    geminiRatePerRequest: 5
  });

  const [adjustData, setAdjustData] = useState({ userId: '', amount: 0, reason: '' });

  const loadData = async () => {
    try {
      const [usersRes, plansRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/user/plans')
      ]);
      setUsers(usersRes.data.data.users);
      setPlans(plansRes.data.data.plans);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/plans', newPlan);
      alert('Plan registered and synchronized with Stripe.');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to create plan');
    }
  };

  const handleAdjustTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/adjust-tokens', adjustData);
      alert('Token adjustment executed successfully.');
      setAdjustData({ userId: '', amount: 0, reason: '' });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Token adjustment failed');
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h2>System Administration</h2>

      {/* Plan Registration */}
      <section style={{ border: '1px solid #ddd', padding: 20, borderRadius: 8, marginBottom: 30 }}>
        <h3>Create New Dynamic Rate Plan (Stripe Synchronized)</h3>
        <form onSubmit={handleCreatePlan} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div>
            <label>Plan Name</label>
            <input required type="text" value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div>
            <label>Price ($/mo)</label>
            <input required type="number" value={newPlan.price} onChange={(e) => setNewPlan({ ...newPlan, price: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>
          <div>
            <label>Monthly Tokens</label>
            <input required type="number" value={newPlan.monthlyTokenQuota} onChange={(e) => setNewPlan({ ...newPlan, monthlyTokenQuota: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>
          <div>
            <label>Video Rate/min</label>
            <input required type="number" value={newPlan.videoRatePerMinute} onChange={(e) => setNewPlan({ ...newPlan, videoRatePerMinute: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>
          <div>
            <label>Recording Rate/min</label>
            <input required type="number" value={newPlan.recordingRatePerMinute} onChange={(e) => setNewPlan({ ...newPlan, recordingRatePerMinute: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>
          <div>
            <label>Gemini Rate/req</label>
            <input required type="number" value={newPlan.geminiRatePerRequest} onChange={(e) => setNewPlan({ ...newPlan, geminiRatePerRequest: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>
          <button type="submit" style={{ gridColumn: 'span 3', padding: 10, background: '#0066cc', color: '#fff', border: 'none', borderRadius: 4 }}>
            Create and Register Plan
          </button>
        </form>
      </section>

      {/* Manual Balance Adjustment Form */}
      <section style={{ border: '1px solid #ddd', padding: 20, borderRadius: 8, marginBottom: 30 }}>
        <h3>Manual Token Balance Adjustment</h3>
        <form onSubmit={handleAdjustTokens} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div>
            <label>Target User</label>
            <select required value={adjustData.userId} onChange={(e) => setAdjustData({ ...adjustData, userId: e.target.value })} style={{ width: '100%', padding: 8 }}>
              <option value="">Select a user...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>
          <div>
            <label>Amount (Positive to Credit, Negative to Debit)</label>
            <input required type="number" value={adjustData.amount} onChange={(e) => setAdjustData({ ...adjustData, amount: Number(e.target.value) })} style={{ width: '100%', padding: 8 }} />
          </div>
          <div>
            <label>Reason / Audit Note</label>
            <input required type="text" value={adjustData.reason} onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })} style={{ width: '100%', padding: 8 }} />
          </div>
          <button type="submit" style={{ gridColumn: 'span 3', padding: 10, background: '#e0a800', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: 4 }}>
            Execute Adjustment
          </button>
        </form>
      </section>

      {/* User Accounts Overview */}
      <section>
        <h3>Registered Accounts</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
              <th style={{ padding: 8, border: '1px solid #ddd' }}>Name</th>
              <th style={{ padding: 8, border: '1px solid #ddd' }}>Email</th>
              <th style={{ padding: 8, border: '1px solid #ddd' }}>Role</th>
              <th style={{ padding: 8, border: '1px solid #ddd' }}>Balance</th>
              <th style={{ padding: 8, border: '1px solid #ddd' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ padding: 8, border: '1px solid #ddd' }}>{u.name}</td>
                <td style={{ padding: 8, border: '1px solid #ddd' }}>{u.email}</td>
                <td style={{ padding: 8, border: '1px solid #ddd' }}>{u.role}</td>
                <td style={{ padding: 8, border: '1px solid #ddd' }}>{u.wallet?.currentTokenBalance ?? 0}</td>
                <td style={{ padding: 8, border: '1px solid #ddd' }}>{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};