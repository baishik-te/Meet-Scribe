import React from 'react';
import { NavRail } from './NavRail';
import { GlobalHeader } from './GlobalHeader';

interface AppShellProps {
  children: React.ReactNode;

  title?: string;
  headerRight?: React.ReactNode;
}


export const AppShell: React.FC<AppShellProps> = ({ children, title, headerRight }) => {
  return (
    <div className="app-shell">
      <NavRail />
      <GlobalHeader headerRight={headerRight} />
      <main className="app-shell__main">
        {title && (
          <header className="top-bar">
            <h1 className="top-title">{title}</h1>
          </header>
        )}
        {children}
      </main>
    </div>
  );
};

export default AppShell;
