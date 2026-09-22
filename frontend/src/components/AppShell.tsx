import React from 'react';
import { NavRail } from './NavRail';

interface AppShellProps {
  children: React.ReactNode;
  
  title?: string;
  headerRight?: React.ReactNode;
}


export const AppShell: React.FC<AppShellProps> = ({ children, title, headerRight }) => {
  const hasHeader = Boolean(title) || Boolean(headerRight);

  return (
    <div className="app-shell">
      <NavRail />
      <main className="app-shell__main">
        {hasHeader && (
          <header className="top-bar">
            {title ? <h1 className="top-title">{title}</h1> : <span />}
            {headerRight}
          </header>
        )}
        {children}
      </main>
    </div>
  );
};

export default AppShell;
