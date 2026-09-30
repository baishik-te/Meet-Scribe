import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import type { NotificationVM } from '../types/viewModels';

function formatTimeAgo(dateString: string): string {
  try {
    const diff = Date.now() - new Date(dateString).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString();
  } catch {
    return '';
  }
}

function getGroupKey(notif: NotificationVM): string {
  if (notif.type === 'MESSAGE_RECEIVED') {
    const sender =
      notif.data?.senderId ||
      notif.data?.senderName ||
      notif.data?.connectionId ||
      'unknown_sender';
    return `MESSAGE_RECEIVED:${sender}`;
  }
  if (notif.type === 'CALL_INCOMING') {
    const caller =
      notif.data?.callerId ||
      notif.data?.callerName ||
      notif.data?.callId ||
      'unknown_caller';
    return `CALL_INCOMING:${caller}`;
  }
  if (notif.type === 'CONNECTION_REQUEST') {
    const requester =
      notif.data?.requesterId ||
      notif.data?.requesterName ||
      'unknown_requester';
    return `CONNECTION_REQUEST:${requester}`;
  }
  if (notif.type === 'CONNECTION_ACCEPTED') {
    return 'CONNECTION_ACCEPTED';
  }
  if (notif.type === 'PAYMENT_SUCCESS') {
    return 'PAYMENT_SUCCESS';
  }
  if (notif.type === 'PLAN_UPGRADE') {
    return 'PLAN_UPGRADE';
  }
  return `${notif.type}:${notif.title}`;
}

function getGroupTitle(type: string, latest: NotificationVM): string {
  if (type === 'MESSAGE_RECEIVED') {
    let senderName = latest.data?.senderName;
    if (!senderName) {
      senderName = latest.title.replace(/^Message from\s+/i, '').trim() || 'User';
    }
    return `Message from ${senderName}`;
  }

  if (type === 'CALL_INCOMING') {
    const callerName = latest.data?.callerName;
    return callerName ? `Call from ${callerName}` : latest.title || 'Incoming Video Call';
  }

  if (type === 'CONNECTION_REQUEST') {
    return latest.title || 'New Connection Request';
  }

  if (type === 'CONNECTION_ACCEPTED') {
    return latest.title || 'Connection Accepted';
  }

  return latest.title;
}

interface GroupedNotificationVM {
  groupKey: string;
  type: string;
  title: string;
  message: string;
  count: number;
  unreadCount: number;
  read: boolean;
  createdAt: string;
  latestNotification: NotificationVM;
  allNotifications: NotificationVM[];
  notificationIds: string[];
}

export const NotificationBell: React.FC = () => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markGroupAsRead,
    markAllAsRead,
    deleteGroup,
    joinCallFromNotification,
    actionError,
    clearActionError
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        clearActionError();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, clearActionError]);

  // Group notifications by type and sender/person
  const groupedNotifications: GroupedNotificationVM[] = useMemo(() => {
    const groupMap = new Map<string, NotificationVM[]>();

    for (const notif of notifications) {
      const key = getGroupKey(notif);
      const existing = groupMap.get(key);
      if (existing) {
        existing.push(notif);
      } else {
        groupMap.set(key, [notif]);
      }
    }

    const groups: GroupedNotificationVM[] = [];

    for (const [groupKey, list] of groupMap.entries()) {
      const latest = list[0]; // first item is newest
      const count = list.length;
      const unread = list.filter((n) => !n.read).length;
      const allRead = unread === 0;

      groups.push({
        groupKey,
        type: latest.type,
        title: getGroupTitle(latest.type, latest),
        message: latest.message,
        count,
        unreadCount: unread,
        read: allRead,
        createdAt: latest.createdAt,
        latestNotification: latest,
        allNotifications: list,
        notificationIds: list.map((n) => n.id)
      });
    }

    return groups;
  }, [notifications]);

  const handleGroupClick = async (group: GroupedNotificationVM) => {
    // Mark all unread notifications in this group as read
    const unreadIds = group.allNotifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) {
      if (unreadIds.length === 1) {
        markAsRead(unreadIds[0]);
      } else {
        markGroupAsRead(unreadIds);
      }
    }

    if (group.type === 'CALL_INCOMING') {
      const ok = await joinCallFromNotification(group.latestNotification);
      if (ok) {
        setOpen(false);
      }
      return;
    }

    if (
      group.type === 'MESSAGE_RECEIVED' ||
      group.type === 'CONNECTION_REQUEST' ||
      group.type === 'CONNECTION_ACCEPTED'
    ) {
      setOpen(false);
      const connId = group.latestNotification.data?.connectionId;
      if (connId) {
        navigate(`/connections?connectionId=${encodeURIComponent(connId)}`);
      } else {
        navigate('/connections');
      }
      return;
    }

    if (group.type === 'PAYMENT_SUCCESS' || group.type === 'PLAN_UPGRADE') {
      navigate('/profile');
      setOpen(false);
      return;
    }
  };

  const handleGroupDismiss = async (group: GroupedNotificationVM, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteGroup(group.notificationIds);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'CALL_INCOMING':
        return (
          <div style={{ ...iconCircle, background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
        );
      case 'MESSAGE_RECEIVED':
        return (
          <div style={{ ...iconCircle, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
        );
      case 'PAYMENT_SUCCESS':
        return (
          <div style={{ ...iconCircle, background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
        );
      case 'PLAN_UPGRADE':
        return (
          <div style={{ ...iconCircle, background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
        );
      case 'CONNECTION_REQUEST':
      case 'CONNECTION_ACCEPTED':
        return (
          <div style={{ ...iconCircle, background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
        );
      default:
        return (
          <div style={{ ...iconCircle, background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          clearActionError();
        }}
        aria-label="View notifications"
        aria-expanded={open}
        title="Notifications"
        style={bellButtonStyle}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span style={badgeStyle}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Notification Popover */}
      {open && (
        <div style={dropdownStyle}>
          {/* Header */}
          <div style={headerStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span style={countPillStyle}>
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                style={markAllBtnStyle}
              >
                Mark all read
              </button>
            )}
          </div>

          {actionError && (
            <div style={{ margin: '8px 16px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, fontSize: 12, color: '#f87171' }}>
              {actionError}
            </div>
          )}

          {/* List */}
          <style>{`
            .notification-list::-webkit-scrollbar {
              width: 5px;
            }
            .notification-list::-webkit-scrollbar-track {
              background: transparent;
            }
            .notification-list::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.2);
              border-radius: 4px;
            }
            .notification-list::-webkit-scrollbar-thumb:hover {
              background: rgba(255, 255, 255, 0.35);
            }
          `}</style>
          <div className="notification-list" style={listStyle}>
            {groupedNotifications.length === 0 ? (
              <div style={emptyStyle}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35, marginBottom: 10 }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <div>No notifications yet</div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                  Calls, messages, and payments will appear here.
                </div>
              </div>
            ) : (
              groupedNotifications.map((group) => {
                const isIncomingCall = group.type === 'CALL_INCOMING';
                return (
                  <div
                    key={group.groupKey}
                    onClick={() => handleGroupClick(group)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = group.read ? 'transparent' : 'rgba(59, 130, 246, 0.06)';
                    }}
                    style={{
                      ...itemStyle,
                      background: group.read ? 'transparent' : 'rgba(59, 130, 246, 0.06)',
                      borderLeft: group.read ? '3px solid transparent' : '3px solid var(--accent-blue)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12, width: '100%', alignItems: 'flex-start' }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {getNotificationIcon(group.type)}
                        {group.count > 1 && (
                          <span
                            style={{
                              position: 'absolute',
                              bottom: -4,
                              right: -4,
                              background: 'var(--accent-blue, #3b82f6)',
                              color: '#ffffff',
                              fontSize: 10,
                              fontWeight: 700,
                              minWidth: 16,
                              height: 16,
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0 4px',
                              border: '2px solid var(--bg-card, #131722)',
                              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.45)',
                              lineHeight: 1,
                              zIndex: 2,
                            }}
                          >
                            {group.count > 99 ? '99+' : group.count}
                          </span>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: group.read ? 600 : 700, color: 'var(--text-primary)' }}>
                            {group.title}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
                            {formatTimeAgo(group.createdAt)}
                          </span>
                        </div>

                        <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                          {group.message}
                        </p>

                        {/* Direct Action for incoming calls */}
                        {isIncomingCall && (
                          <div style={{ marginTop: 10 }}>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const ok = await joinCallFromNotification(group.latestNotification);
                                if (ok) {
                                  setOpen(false);
                                }
                              }}
                              style={joinCallBtnStyle}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                              Join Call
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Delete / Dismiss notification group */}
                      <button
                        type="button"
                        onClick={(e) => handleGroupDismiss(group, e)}
                        title="Dismiss"
                        aria-label="Dismiss notification"
                        style={dismissBtnStyle}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const bellButtonStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  borderRadius: '50%',
  background: 'var(--bg-card-secondary, #1b2030)',
  border: '1px solid var(--border-color, #272f45)',
  color: 'var(--text-primary, #ffffff)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  outline: 'none',
};

const badgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: -2,
  right: -2,
  background: 'var(--accent-red, #ef4444)',
  color: '#ffffff',
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 5px',
  borderRadius: 10,
  minWidth: 16,
  height: 16,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
  border: '2px solid var(--bg-surface, #0d111c)',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 10px)',
  right: 0,
  width: 360,
  maxWidth: 'calc(100vw - 32px)',
  background: 'var(--bg-card, #131722)',
  border: '1px solid var(--border-color, #272f45)',
  borderRadius: 'var(--radius-lg, 16px)',
  boxShadow: '0 20px 48px rgba(0, 0, 0, 0.55), 0 0 1px rgba(255, 255, 255, 0.1)',
  zIndex: 1000,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  animation: 'fadeIn 0.15s ease-out',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 18px',
  borderBottom: '1px solid var(--border-color, #272f45)',
  background: 'rgba(255, 255, 255, 0.02)',
};

const countPillStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  background: 'rgba(59, 130, 246, 0.2)',
  color: 'var(--accent-blue, #3b82f6)',
  padding: '2px 8px',
  borderRadius: 12,
};

const markAllBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--accent-blue, #3b82f6)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  padding: '4px 6px',
};

const listStyle: React.CSSProperties = {
  maxHeight: 236,
  overflowY: 'auto',
  overflowX: 'hidden',
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
};

const itemStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  cursor: 'pointer',
  transition: 'background-color 0.15s ease',
  minHeight: 74,
  boxSizing: 'border-box',
};

const iconCircle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const joinCallBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  color: '#fff',
  border: 'none',
  padding: '6px 14px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
};

const dismissBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted, #64748b)',
  cursor: 'pointer',
  fontSize: 14,
  padding: '2px 6px',
  borderRadius: 4,
  lineHeight: 1,
};

const emptyStyle: React.CSSProperties = {
  padding: '40px 20px',
  textAlign: 'center',
  color: 'var(--text-secondary, #94a3b8)',
  fontSize: 14,
};

export default NotificationBell;
