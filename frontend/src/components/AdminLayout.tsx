import React from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { useAuth } from '../context/AuthContext';

export const AdminLayout: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="app-container">
      <AdminSidebar />
      <div className="main-viewport">
        <div className="top-bar">
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Management Console
            </div>
            <div className="top-title">System Administration</div>
          </div>
          <div className="pill-badge" style={{ borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}>
            🛡 Root Administrator: {user?.name || 'System Admin'}
          </div>
        </div>

        <div className="admin-content-area">
          <Outlet />
        </div>
      </div>
    </div>
  );
};