import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import type { NotificationVM } from '../types/viewModels';

interface NotificationContextType {
  notifications: NotificationVM[];
  unreadCount: number;
  loading: boolean;
  loadNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markGroupAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteGroup: (ids: string[]) => Promise<void>;
  joinCallFromNotification: (notification: NotificationVM) => Promise<boolean>;
  actionError: string | null;
  clearActionError: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  loadNotifications: async () => {},
  markAsRead: async () => {},
  markGroupAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotification: async () => {},
  deleteGroup: async () => {},
  joinCallFromNotification: async () => false,
  actionError: null,
  clearActionError: () => {}
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationVM[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.get('/user/notifications');
      if (res.data?.success && res.data?.data) {
        setNotifications(res.data.data.notifications || []);
        setUnreadCount(res.data.data.unreadCount || 0);
      }
    } catch (err: any) {
      console.warn('[NotificationContext] Failed to load notifications:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Listen to real-time notifications via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data: { notification: NotificationVM }) => {
      if (!data?.notification) return;
      const newNotif = data.notification;

      setNotifications((prev) => {
        // avoid duplicates
        const exists = prev.some((n) => n.id === newNotif.id);
        if (exists) return prev;
        return [newNotif, ...prev];
      });

      setUnreadCount((c) => c + 1);
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket]);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/user/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err: any) {
      console.error('[NotificationContext.markAsRead] Error:', err.message);
    }
  };

  const markGroupAsRead = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    try {
      await api.post('/user/notifications/mark-read', { ids });
      const idSet = new Set(ids);
      setNotifications((prev) =>
        prev.map((n) => (idSet.has(n.id) ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => {
        const unreadInGroup = notifications.filter((n) => idSet.has(n.id) && !n.read).length;
        return Math.max(0, c - unreadInGroup);
      });
    } catch (err: any) {
      console.error('[NotificationContext.markGroupAsRead] Error:', err.message);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/user/notifications/read-all');
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err: any) {
      console.error('[NotificationContext.markAllAsRead] Error:', err.message);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/user/notifications/${id}`);
      setNotifications((prev) => {
        const item = prev.find((n) => n.id === id);
        if (item && !item.read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
    } catch (err: any) {
      console.error('[NotificationContext.deleteNotification] Error:', err.message);
    }
  };

  const deleteGroup = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    try {
      await api.post('/user/notifications/delete-many', { ids });
      const idSet = new Set(ids);
      setNotifications((prev) => {
        const unreadInGroup = prev.filter((n) => idSet.has(n.id) && !n.read).length;
        if (unreadInGroup > 0) {
          setUnreadCount((c) => Math.max(0, c - unreadInGroup));
        }
        return prev.filter((n) => !idSet.has(n.id));
      });
    } catch (err: any) {
      console.error('[NotificationContext.deleteGroup] Error:', err.message);
    }
  };

  const joinCallFromNotification = async (notification: NotificationVM): Promise<boolean> => {
    setActionError(null);
    const callId = notification.data?.callId;
    if (!callId) {
      setActionError('Invalid call notification: missing call ID');
      return false;
    }

    try {
      markAsRead(notification.id);

      const res = await api.post('/user/calls/accept', { callId });
      const { call, livekitToken } = res.data.data;
      const roomName = call?.roomName || notification.data?.roomName;

      navigate(
        `/call/room?callId=${callId}&room=${encodeURIComponent(roomName)}&token=${encodeURIComponent(
          livekitToken
        )}`
      );
      return true;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Could not join call. It may have already ended.';
      console.warn('[NotificationContext] Failed to join call:', msg);
      setActionError(msg);
      return false;
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        loadNotifications,
        markAsRead,
        markGroupAsRead,
        markAllAsRead,
        deleteNotification,
        deleteGroup,
        joinCallFromNotification,
        actionError,
        clearActionError: () => setActionError(null)
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
