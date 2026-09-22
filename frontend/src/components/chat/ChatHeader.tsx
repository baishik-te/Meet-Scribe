import React, { useEffect, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { VideoIcon, PeopleIcon, MoreIcon, BackIcon } from './icons';

interface ChatHeaderProps {
  name: string;
  email: string;
  statusText: string;
  online?: boolean;
  onStartCall: () => void;
  callPending?: boolean;
  onBack: () => void;
  onBlock: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  name,
  email,
  statusText,
  online,
  onStartCall,
  callPending,
  onBack,
  onBlock
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  return (
    <header className="msgx-header">
      <button
        type="button"
        className="msgx-iconbtn msgx-header__back"
        onClick={onBack}
        aria-label="Back to conversations"
      >
        <BackIcon />
      </button>

      <Avatar name={name} size="lg" online={online} />
      <div className="msgx-header__id">
        <h2 className="msgx-header__name" title={email}>
          {name}
        </h2>
        <div className="msgx-header__status">{statusText}</div>
      </div>

      <div className="msgx-header__actions">
        <button
          type="button"
          className="msgx-iconbtn"
          onClick={onStartCall}
          disabled={callPending}
          aria-label="Start video call"
          title="Start video call"
          style={{ color: 'var(--accent-blue)' }}
        >
          <VideoIcon />
        </button>
        <button
          type="button"
          className="msgx-iconbtn"
          aria-label="Participants"
          title="Participants"
          disabled
        >
          <PeopleIcon />
        </button>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="msgx-iconbtn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="More options"
          >
            <MoreIcon />
          </button>
          {menuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                minWidth: 160,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                zIndex: 50,
                overflow: 'hidden'
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onStartCall();
                }}
                style={menuItemStyle}
              >
                Start video call
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onBlock();
                }}
                style={{ ...menuItemStyle, color: 'var(--accent-red)' }}
              >
                Block contact
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-primary)',
  padding: '10px 14px',
  fontSize: 14,
  cursor: 'pointer'
};

export default ChatHeader;
