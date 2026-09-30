import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ProfileAvatar } from './ProfileAvatar';
import { NotificationBell } from './NotificationBell';

interface GlobalHeaderProps {
  headerRight?: React.ReactNode;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({ headerRight }) => {
  const { user } = useAuth();
  const homeRoute = user?.role === 'ADMIN' ? '/admin' : '/dashboard';

  return (
    <header className="global-header">
      <Link to={homeRoute} className="global-header__brand" aria-label="MeetScribe Home">
        <img src="/logo.png" alt="MeetScribe Logo" className="global-header__logo" />
        <span className="global-header__title">Meet Scribe</span>
      </Link>
      <div className="global-header__right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {headerRight}
        <NotificationBell />
        <Link to="/profile" className="global-header__avatar" aria-label="Open your profile">
          <ProfileAvatar user={user} size={38} />
        </Link>
      </div>
    </header>
  );
};

export default GlobalHeader;
