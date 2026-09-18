import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isHomeActive = location.pathname === '/dashboard' || location.pathname === '/admin';
  const isVideoActive = location.pathname === '/meetings' || location.pathname.startsWith('/call');
  const isConnectionsActive = location.pathname === '/connections';
  const isProfileActive = location.pathname === '/profile';
  const isSettingsActive = location.pathname === '/settings';

  const handleHomeNavigation = () => {
    if (user?.role === 'ADMIN') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <aside className="dock-sidebar">
      {/* 1. Platform Logo */}
      <div className="dock-logo-container" onClick={handleHomeNavigation} title="Home">
        <img src="/logo.png" alt="Platform Logo" className="dock-logo-img" />
      </div>

      {/* Main Navigation Group */}
      <nav className="dock-nav-group">
        {/* 2. Home (Dashboard) */}
        <button
          className={`dock-btn ${isHomeActive ? 'active' : ''}`}
          onClick={handleHomeNavigation}
          title={user?.role === 'ADMIN' ? 'Admin Dashboard' : 'User Dashboard'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3L2 12H5V20H10V14H14V20H19V12H22L12 3Z" />
          </svg>
        </button>

        {/* 3. Video Meetings */}
        <button
          className={`dock-btn ${isVideoActive ? 'active' : ''}`}
          onClick={() => navigate('/meetings')}
          title="Video Meetings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 10.5V7C17 5.9 16.1 5 15 5H4C2.9 5 2 5.9 2 7V17C2 18.1 2.9 19 4 19H15C16.1 19 17 18.1 17 17V13.5L21 17.5V6.5L17 10.5Z" />
          </svg>
        </button>

        {/* 4. Message / Connect (Search users by email & connect) */}
        <button
          className={`dock-btn ${isConnectionsActive ? 'active' : ''}`}
          onClick={() => navigate('/connections')}
          title="Connect & Messages"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM6 9H18V11H6V9ZM14 14H6V12H14V14ZM18 8H6V6H18V8Z" />
          </svg>
        </button>

        {/* 5. Profile & Plans */}
        <button
          className={`dock-btn ${isProfileActive ? 'active' : ''}`}
          onClick={() => navigate('/profile')}
          title="Profile & Subscriptions"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" />
          </svg>
        </button>
      </nav>

      {/* Bottom Group */}
      <div className="dock-bottom-group">
        {/* 6. Settings */}
        <button
          className={`dock-btn ${isSettingsActive ? 'active' : ''}`}
          onClick={() => navigate('/settings')}
          title="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8C9.79 8 8 9.79 8 12C8 14.21 9.79 16 12 16C14.21 16 16 14.21 16 12C16 9.79 14.21 8 12 8ZM19.43 12.97C19.47 12.65 19.5 12.33 19.5 12C19.5 11.67 19.47 11.34 19.43 11.03L21.54 9.37C21.73 9.22 21.78 8.95 21.66 8.73L19.66 5.27C19.54 5.05 19.27 4.97 19.05 5.05L16.56 6.05C16.04 5.65 15.48 5.32 14.87 5.07L14.49 2.42C14.46 2.18 14.25 2 14 2H10C9.75 2 9.54 2.18 9.51 2.42L9.13 5.07C8.52 5.32 7.96 5.66 7.44 6.05L4.95 5.05C4.73 4.96 4.46 5.05 4.34 5.27L2.34 8.73C2.21 8.95 2.27 9.22 2.46 9.37L4.57 11.03C4.53 11.34 4.5 11.67 4.5 12C4.5 12.33 4.53 12.65 4.57 12.97L2.46 14.63C2.27 14.78 2.21 15.05 2.34 15.27L4.34 18.73C4.46 18.95 4.73 19.03 4.95 18.95L7.44 17.95C7.96 18.35 8.52 18.68 9.13 18.93L9.51 21.58C9.54 21.82 9.75 22 10 22H14C14.25 22 14.46 21.82 14.49 21.58L14.87 18.93C15.48 18.68 16.04 18.34 16.56 17.95L19.05 18.95C19.28 19.04 19.54 18.95 19.66 18.73L21.66 15.27C21.78 15.05 21.73 14.78 21.54 14.63L19.43 12.97Z" />
          </svg>
        </button>

        {/* 7. Sign Out */}
        <button
          className="dock-btn dock-btn-exit"
          onClick={logout}
          title="Sign Out"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10.09 15.59L11.5 17L16.5 12L11.5 7L10.09 8.41L12.67 11H3V13H12.67L10.09 15.59ZM19 3H5C3.89 3 3 3.9 3 5V9H5V5H19V19H5V15H3V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3Z" />
          </svg>
        </button>
      </div>
    </aside>
  );
};