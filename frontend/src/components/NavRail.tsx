import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  key: 'dashboard' | 'meetings' | 'connections' | 'library' | 'meetscribe' | 'profile' | 'settings';
  label: string;
  route: string;
  icon: React.ReactNode;
  isActive: (pathname: string) => boolean;
}

const DashboardIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3L2 12H5V20H10V14H14V20H19V12H22L12 3Z" />
  </svg>
);

const MeetingsIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 10.5V7C17 5.9 16.1 5 15 5H4C2.9 5 2 5.9 2 7V17C2 18.1 2.9 19 4 19H15C16.1 19 17 18.1 17 17V13.5L21 17.5V6.5L17 10.5Z" />
  </svg>
);

const ConnectionsIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM6 9H18V11H6V9ZM14 14H6V12H14V14ZM18 8H6V6H18V8Z" />
  </svg>
);

const LibraryIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 6H2V20C2 21.1 2.9 22 4 22H18V20H4V6ZM20 2H8C6.9 2 6 2.9 6 4V16C6 17.1 6.9 18 8 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM12 14.5V5.5L18 10L12 14.5Z" />
  </svg>
);


const MeetScribeIcon = (
  <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <radialGradient id="msai-bg" cx="50%" cy="38%" r="70%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </radialGradient>
    </defs>
    <circle cx="24" cy="24" r="22" fill="url(#msai-bg)" />
    {/* speech bubble */}
    <rect x="9" y="14" width="21" height="16" rx="4" fill="#ffffff" />
    <path d="M13 30 L13 36 L19.5 30 Z" fill="#ffffff" />
    {/* AI wordmark */}
    <text
      x="19.5"
      y="26.5"
      textAnchor="middle"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="11"
      fontWeight="700"
      fill="#1d4ed8"
    >
      AI
    </text>
    {/* sparkles */}
    <path d="M35 11 l1.3 3.3 3.3 1.3 -3.3 1.3 -1.3 3.3 -1.3 -3.3 -3.3 -1.3 3.3 -1.3 Z" fill="#ffffff" />
    <path d="M41.5 19 l0.8 2 2 0.8 -2 0.8 -0.8 2 -0.8 -2 -2 -0.8 2 -0.8 Z" fill="#ffffff" />
    {/* transcript lines */}
    <rect x="31" y="25" width="10" height="2.4" rx="1.2" fill="#bcd7ff" />
    <rect x="31" y="29.5" width="8" height="2.4" rx="1.2" fill="#bcd7ff" />
    <rect x="31" y="34" width="6" height="2.4" rx="1.2" fill="#9ec3ff" />
  </svg>
);

const ProfileIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" />
  </svg>
);

const SettingsIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 8C9.79 8 8 9.79 8 12C8 14.21 9.79 16 12 16C14.21 16 16 14.21 16 12C16 9.79 14.21 8 12 8ZM19.43 12.97C19.47 12.65 19.5 12.33 19.5 12C19.5 11.67 19.47 11.34 19.43 11.03L21.54 9.37C21.73 9.22 21.78 8.95 21.66 8.73L19.66 5.27C19.54 5.05 19.27 4.97 19.05 5.05L16.56 6.05C16.04 5.65 15.48 5.32 14.87 5.07L14.49 2.42C14.46 2.18 14.25 2 14 2H10C9.75 2 9.54 2.18 9.51 2.42L9.13 5.07C8.52 5.32 7.96 5.66 7.44 6.05L4.95 5.05C4.73 4.96 4.46 5.05 4.34 5.27L2.34 8.73C2.21 8.95 2.27 9.22 2.46 9.37L4.57 11.03C4.53 11.34 4.5 11.67 4.5 12C4.5 12.33 4.53 12.65 4.57 12.97L2.46 14.63C2.27 14.78 2.21 15.05 2.34 15.27L4.34 18.73C4.46 18.95 4.73 19.03 4.95 18.95L7.44 17.95C7.96 18.35 8.52 18.68 9.13 18.93L9.51 21.58C9.54 21.82 9.75 22 10 22H14C14.25 22 14.46 21.82 14.49 21.58L14.87 18.93C15.48 18.68 16.04 18.34 16.56 17.95L19.05 18.95C19.28 19.04 19.54 18.95 19.66 18.73L21.66 15.27C21.78 15.05 21.73 14.78 21.54 14.63L19.43 12.97Z" />
  </svg>
);

const SignOutIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10.09 15.59L11.5 17L16.5 12L11.5 7L10.09 8.41L12.67 11H3V13H12.67L10.09 15.59ZM19 3H5C3.89 3 3 3.9 3 5V9H5V5H19V19H5V15H3V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3Z" />
  </svg>
);

const primaryItems: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    route: '/dashboard',
    icon: DashboardIcon,
    isActive: (pathname) => pathname === '/dashboard',
  },
  {
    key: 'meetings',
    label: 'Meetings',
    route: '/meetings',
    icon: MeetingsIcon,
    isActive: (pathname) => pathname === '/meetings' || pathname.startsWith('/call'),
  },
  {
    key: 'connections',
    label: 'Connections',
    route: '/connections',
    icon: ConnectionsIcon,
    isActive: (pathname) => pathname === '/connections',
  },
  {
    key: 'library',
    label: 'Library',
    route: '/library',
    icon: LibraryIcon,
    isActive: (pathname) => pathname === '/library',
  },
  {
    key: 'meetscribe',
    label: 'MeetScribe AI',
    route: '/meetscribe',
    icon: MeetScribeIcon,
    isActive: (pathname) => pathname === '/meetscribe',
  },
  {
    key: 'profile',
    label: 'Profile',
    route: '/profile',
    icon: ProfileIcon,
    isActive: (pathname) => pathname === '/profile',
  },
];

const settingsItem: NavItem = {
  key: 'settings',
  label: 'Settings',
  route: '/settings',
  icon: SettingsIcon,
  isActive: (pathname) => pathname === '/settings',
};

export const NavRail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const renderNavButton = (item: NavItem) => (
    <button
      key={item.key}
      type="button"
      className={`nav-rail__btn ${item.isActive(location.pathname) ? 'active' : ''}`}
      onClick={() => navigate(item.route)}
      title={item.label}
      aria-label={item.label}
    >
      {item.icon}
      <span className="nav-rail__label">{item.label}</span>
    </button>
  );

  return (
    <nav className="nav-rail nav-rail--bottom" aria-label="Primary navigation">
      <div className="nav-rail__group">{primaryItems.map(renderNavButton)}</div>

      <div className="nav-rail__group nav-rail__group--secondary">
        {renderNavButton(settingsItem)}

        <button
          type="button"
          className="nav-rail__btn"
          onClick={logout}
          title="Sign Out"
          aria-label="Sign Out"
        >
          {SignOutIcon}
          <span className="nav-rail__label">Sign Out</span>
        </button>
      </div>
    </nav>
  );
};
