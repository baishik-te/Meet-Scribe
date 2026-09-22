import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import type { MessageVM, MessageSummaryVM } from '../types/viewModels';

interface NewMessagePayload {
  message: MessageVM;
  sender: { id: string; name: string; email: string };
}
interface ReadPayload {
  connectionId: string;
  readerId: string;
  readAt: string;
}
interface TypingPayload {
  connectionId: string;
  userId: string;
  typing: boolean;
}

export interface UseMessages {
  summaries: Record<string, MessageSummaryVM>;
  summariesLoading: boolean;
  refreshSummaries: () => Promise<void>;

  messages: MessageVM[];
  messagesLoading: boolean;
  messagesError: string | null;
  loadMessages: (connectionId: string) => Promise<void>;

  sending: boolean;
  sendError: string | null;
  sendMessage: (connectionId: string, body: string) => Promise<boolean>;

  /** connectionId -> whether the OTHER participant is currently typing. */
  typing: Record<string, boolean>;
  notifyTyping: (connectionId: string) => void;

  activeConnectionId: string | null;
  setActiveConnectionId: (id: string | null) => void;
}


export function useMessages(): UseMessages {
  const { user } = useAuth();
  const { socket } = useSocket();
  const currentUserId = user?.id ?? null;

  const [summaries, setSummaries] = useState<Record<string, MessageSummaryVM>>({});
  const [summariesLoading, setSummariesLoading] = useState(false);

  const [messages, setMessages] = useState<MessageVM[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);

  
  const activeRef = useRef<string | null>(null);
  useEffect(() => {
    activeRef.current = activeConnectionId;
  }, [activeConnectionId]);

  const refreshSummaries = useCallback(async () => {
    try {
      setSummariesLoading(true);
      const res = await api.get('/user/messages/summary');
      const list: MessageSummaryVM[] = res.data.data.summaries;
      const map: Record<string, MessageSummaryVM> = {};
      for (const s of list) map[s.connectionId] = s;
      setSummaries(map);
    } catch {
      // Non-fatal: the sidebar simply shows no previews.
    } finally {
      setSummariesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUserId) refreshSummaries();
  }, [currentUserId, refreshSummaries]);

  const loadMessages = useCallback(
    async (connectionId: string) => {
      setMessagesLoading(true);
      setMessagesError(null);
      try {
        const res = await api.get(`/user/connections/${connectionId}/messages`);
        setMessages(res.data.data.messages);
        setSummaries((prev) => {
          if (!prev[connectionId]) return prev;
          return { ...prev, [connectionId]: { ...prev[connectionId], unreadCount: 0 } };
        });
      } catch (err: any) {
        setMessagesError(err.response?.data?.error?.message || 'Failed to load messages');
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (connectionId: string, body: string): Promise<boolean> => {
      const trimmed = body.trim();
      if (!trimmed) return false;
      setSending(true);
      setSendError(null);
      try {
        const res = await api.post(`/user/connections/${connectionId}/messages`, {
          body: trimmed
        });
        const message: MessageVM = res.data.data.message;
        if (activeRef.current === connectionId) {
          setMessages((prev) => [...prev, message]);
        }
        setSummaries((prev) => ({
          ...prev,
          [connectionId]: {
            connectionId,
            lastMessage: {
              id: message.id,
              body: message.body,
              senderId: message.senderId,
              createdAt: message.createdAt
            },
            unreadCount: prev[connectionId]?.unreadCount ?? 0
          }
        }));
        return true;
      } catch (err: any) {
        setSendError(err.response?.data?.error?.message || 'Message could not be sent');
        return false;
      } finally {
        setSending(false);
      }
    },
    []
  );

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActive = useRef<string | null>(null);

  const emitTyping = useCallback((connectionId: string, isTyping: boolean) => {
    api.post(`/user/connections/${connectionId}/typing`, { typing: isTyping }).catch(() => {});
  }, []);

  const notifyTyping = useCallback(
    (connectionId: string) => {
      if (typingActive.current !== connectionId) {
        typingActive.current = connectionId;
        emitTyping(connectionId, true);
      }
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        typingActive.current = null;
        emitTyping(connectionId, false);
      }, 2000);
    },
    [emitTyping]
  );

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  // Socket subscriptions 
  useEffect(() => {
    if (!socket || !currentUserId) return;

    const handleNew = (payload: NewMessagePayload) => {
      const { message } = payload;
      const isActive = activeRef.current === message.connectionId;
      if (isActive) {
        setMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message]
        );
        api.get(`/user/connections/${message.connectionId}/messages`).catch(() => {});
      }
      setSummaries((prev) => ({
        ...prev,
        [message.connectionId]: {
          connectionId: message.connectionId,
          lastMessage: {
            id: message.id,
            body: message.body,
            senderId: message.senderId,
            createdAt: message.createdAt
          },
          unreadCount: isActive ? 0 : (prev[message.connectionId]?.unreadCount ?? 0) + 1
        }
      }));
      setTyping((prev) => ({ ...prev, [message.connectionId]: false }));
    };

    const handleRead = (payload: ReadPayload) => {
      if (payload.readerId === currentUserId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.connectionId === payload.connectionId && m.senderId === currentUserId && !m.readAt
            ? { ...m, readAt: payload.readAt }
            : m
        )
      );
    };

    const handleTyping = (payload: TypingPayload) => {
      if (payload.userId === currentUserId) return;
      setTyping((prev) => ({ ...prev, [payload.connectionId]: payload.typing }));
    };

    socket.on('message:new', handleNew);
    socket.on('message:read', handleRead);
    socket.on('message:typing', handleTyping);

    return () => {
      socket.off('message:new', handleNew);
      socket.off('message:read', handleRead);
      socket.off('message:typing', handleTyping);
    };
  }, [socket, currentUserId]);

  return {
    summaries,
    summariesLoading,
    refreshSummaries,
    messages,
    messagesLoading,
    messagesError,
    loadMessages,
    sending,
    sendError,
    sendMessage,
    typing,
    notifyTyping,
    activeConnectionId,
    setActiveConnectionId
  };
}
