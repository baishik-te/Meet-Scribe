import React, { useEffect, useState } from 'react';
import api from '../../api/client';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const loadUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.data.users);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleStatus = async (user: any) => {
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to change ${user.name}'s status to ${nextStatus}?`)) return;

    try {
      await api.patch(`/admin/users/${user.id}/status`, { status: nextStatus });
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Status update failed');
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <span>Registered User Accounts ({users.length})</span>
        <input
          type="text"
          placeholder="Filter by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="dark-input"
          style={{ width: 260 }}
        />
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Token Balance</th>
              <th>Email Verified</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.email}</div>
                </td>
                <td>
                  <span className="pill-badge" style={{ fontSize: 11, display: 'inline-block' }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>
                  {u.wallet?.currentTokenBalance?.toLocaleString() ?? 0}
                </td>
                <td>{u.emailVerified ? '✅ Yes' : '❌ No'}</td>
                <td>
                  <span className={`badge-status ${u.status?.toLowerCase()}`}>{u.status}</span>
                </td>
                <td>
                  <button
                    onClick={() => handleToggleStatus(u)}
                    className="admin-btn"
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      backgroundColor: u.status === 'ACTIVE' ? 'var(--accent-red)' : '#10b981'
                    }}
                  >
                    {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};