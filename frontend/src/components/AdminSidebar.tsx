import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

export const AdminSidebar: React.FC = () => {
  const navigate = useNavigate();

  return (
    <aside className="admin-sidebar">
      <div 
        className="admin-sidebar-logo-container" 
        onClick={() => navigate('/admin')} 
        title="Admin Console"
      >
        <img src="/logo.png" alt="Platform Logo" className="admin-sidebar-logo-img" />
        <span className="admin-sidebar-brand">Admin Console</span>
      </div>

      <div className="admin-sidebar-divider" />

      <nav className="admin-sidebar-nav">
        <NavLink 
          to="/admin" 
          end 
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="admin-nav-icon">📊</span>
          <span>Overview</span>
        </NavLink>

        <NavLink 
          to="/admin/users" 
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="admin-nav-icon">👥</span>
          <span>Users</span>
        </NavLink>

        <NavLink 
          to="/admin/plans" 
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="admin-nav-icon">💳</span>
          <span>Plans & Rates</span>
        </NavLink>

        <NavLink 
          to="/admin/tokens" 
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="admin-nav-icon">💎</span>
          <span>Token Ledger</span>
        </NavLink>

        <NavLink 
          to="/admin/calls" 
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="admin-nav-icon">📞</span>
          <span>LiveKit Calls</span>
        </NavLink>
      </nav>
    </aside>
  );
};