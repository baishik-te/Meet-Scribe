import React from 'react';
import { NavRail } from './NavRail';
import { GlobalHeader } from './GlobalHeader';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  headerRight?: React.ReactNode;
  fullHeight?: boolean;
  hideTitleOnMobile?: boolean;
  hideNavOnMobile?: boolean;
  mainClassName?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  title,
  headerRight,
  fullHeight = false,
  hideTitleOnMobile = false,
  hideNavOnMobile = false,
  mainClassName = '',
}) => {
  const mainClassNames = [
    'app-shell__main',
    fullHeight ? (hideNavOnMobile ? 'app-shell__main--full-height' : 'app-shell__main--full-height-with-nav') : '',
    mainClassName,
  ].filter(Boolean).join(' ');

  return (
    <div className={`app-shell ${hideNavOnMobile ? 'app-shell--hide-mobile-nav' : ''}`}>
      <NavRail />
      <GlobalHeader headerRight={headerRight} />
      <main className={mainClassNames}>
        {title && (
          <header className={`top-bar ${hideTitleOnMobile ? 'top-bar--hide-mobile' : ''}`}>
            <h1 className="top-title">{title}</h1>
          </header>
        )}
        {children}
      </main>
    </div>
  );
};

export default AppShell;
