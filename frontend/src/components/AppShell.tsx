import React from 'react';
import { NavRail } from './NavRail';

interface AppShellProps {
  children: React.ReactNode;
  /** Optional page-scoped top bar content rendered in the shell header. */
  title?: string;
  headerRight?: React.ReactNode;
}

/**
 * Shared authenticated layout that owns the Teams-style Nav_Rail.
 *
 * Renders `.app-shell` as a flex row: the `<NavRail />` alongside an
 * `.app-shell__main` scroll region. When a `title` or `headerRight` is
 * provided, a `.top-bar` header is rendered above the page content.
 */
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
