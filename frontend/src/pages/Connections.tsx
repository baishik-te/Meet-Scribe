import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { AppShell } from '../components/AppShell';
import { InlineNotice } from '../components/InlineNotice';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatHeader } from '../components/chat/ChatHeader';
import { MessageList } from '../components/chat/MessageList';
import { MessageComposer } from '../components/chat/MessageComposer';
import { EmptyChatState } from '../components/chat/EmptyChatState';
import { useMessages } from '../hooks/useMessages';
import { useAuth } from '../context/AuthContext';
import type { ConnectionVM, SearchUserVM } from '../types/viewModels';
import { isValidSearchQuery } from '../lib/connectionActions';
import '../styles/messages.css';

const FAVORITES_KEY = 'msgx.favorites';

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Messages page — a modern Teams-style chat interface.
 *
 * Reuses every existing connection endpoint verbatim (search / send / respond /
 * cancel / block / unblock / call-initiate) and the existing Socket.IO channel.
 * Real 1:1 messaging is backed by the additive /user/connections/:id/messages
 * endpoints via the `useMessages` hook. Mounted at the existing /connections
 * route inside the shared AppShell (global Nav_Rail preserved).
 */
export const Connections: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [connections, setConnections] = useState<ConnectionVM[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserVM[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [callPending, setCallPending] = useState(false);

  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());

  const {
    summaries,
    messages,
    messagesLoading,
    messagesError,
    loadMessages,
    sending,
    sendError,
    sendMessage,
    typing,
    notifyTyping,
    setActiveConnectionId
  } = useMessages();

  const loadConnections = async () => {
    try {
      const res = await api.get('/user/connections');
      setConnections(res.data.data.connections);
      setListError(null);
    } catch (err: any) {
      setListError(err.response?.data?.error?.message || 'Failed to load connections');
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const selectedConnection = useMemo(
    () => connections.find((c) => c.id === selectedConnectionId) ?? null,
    [connections, selectedConnectionId]
  );

  const pending = useMemo(
    () => connections.filter((c) => c.status === 'PENDING'),
    [connections]
  );

  // ── Conversation selection ──
  const handleSelect = (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    setActiveConnectionId(connectionId);
    setActionError(null);
    setActionNotice(null);
    loadMessages(connectionId);
  };

  // ── Directory search (reuses GET /user/connections/search) ──
  const handleSearchSubmit = async () => {
    if (!isValidSearchQuery(searchQuery)) {
      // Empty query simply clears directory results; keep the local filter.
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    try {
      const res = await api.get(
        `/user/connections/search?q=${encodeURIComponent(searchQuery)}`
      );
      setSearchResults(res.data.data.users);
      setSearchError(null);
    } catch (err: any) {
      setSearchError(err.response?.data?.error?.message || 'Search failed');
    }
  };

  const handleSendRequest = async (receiverId: string) => {
    try {
      await api.post('/user/connections', { receiverId });
      setActionNotice('Connection invitation sent.');
      setActionError(null);
      setSearchResults([]);
      setSearchQuery('');
      loadConnections();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || 'Failed to send request');
    }
  };

  const handleRespond = async (id: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      await api.patch(`/user/connections/${id}/respond`, { action });
      setActionError(null);
      loadConnections();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || 'Response action failed');
    }
  };

  const handleCancelRequest = async (id: string) => {
    try {
      await api.delete(`/user/connections/${id}/cancel`);
      setActionNotice('Connection request cancelled');
      setActionError(null);
      loadConnections();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || 'Failed to cancel request');
    }
  };

  const handleBlockUser = async (userId: string) => {
    try {
      await api.post('/user/connections/block', { userId });
      setActionNotice('User blocked successfully');
      setActionError(null);
      if (selectedConnection && selectedConnection.contact.id === userId) {
        setSelectedConnectionId(null);
        setActiveConnectionId(null);
      }
      loadConnections();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || 'Failed to block user');
    }
  };

  const handleStartCall = async (targetUserId: string) => {
    setCallPending(true);
    try {
      const res = await api.post('/user/calls/initiate', { receiverId: targetUserId });
      const { call, livekitToken } = res.data.data;
      navigate(
        `/call/room?callId=${call.id}&room=${call.roomName}&token=${encodeURIComponent(
          livekitToken
        )}`
      );
    } catch (err: any) {
      // Stay on the page and surface the error inline; do NOT navigate.
      setActionError(err.response?.data?.error?.message || 'Unable to establish call');
    } finally {
      setCallPending(false);
    }
  };

  const toggleFavorite = (connectionId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(connectionId)) next.delete(connectionId);
      else next.add(connectionId);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleSend = async (text: string) => {
    if (!selectedConnectionId) return;
    const ok = await sendMessage(selectedConnectionId, text);
    if (ok) loadConnections();
  };

  const handleBack = () => {
    setSelectedConnectionId(null);
    setActiveConnectionId(null);
  };

  const peerName = selectedConnection?.contact.name ?? '';
  const peerTyping = selectedConnectionId ? Boolean(typing[selectedConnectionId]) : false;
  const headerStatus = peerTyping ? 'typing…' : selectedConnection?.contact.email ?? '';

  return (
    <AppShell title="Messages">
      <div className={`msgx${selectedConnection ? ' msgx--has-active' : ''}`}>
        <ChatSidebar
          connections={connections}
          summaries={summaries}
          selectedConnectionId={selectedConnectionId}
          onSelect={handleSelect}
          currentUserId={user?.id ?? null}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          pending={pending}
          onAccept={(id) => handleRespond(id, 'ACCEPT')}
          onReject={(id) => handleRespond(id, 'REJECT')}
          onCancel={handleCancelRequest}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          searchResults={searchResults}
          searchError={searchError}
          onDismissSearchError={() => setSearchError(null)}
          onConnect={handleSendRequest}
          typing={typing}
        />

        <section className="msgx-main" aria-label="Conversation">
          {listError && (
            <div style={{ padding: 12 }}>
              <InlineNotice
                message={listError}
                variant="error"
                onDismiss={() => setListError(null)}
              />
            </div>
          )}

          {!selectedConnection ? (
            <EmptyChatState />
          ) : (
            <>
              <ChatHeader
                name={peerName}
                email={selectedConnection.contact.email}
                statusText={headerStatus}
                onStartCall={() => handleStartCall(selectedConnection.contact.id)}
                callPending={callPending}
                onBack={handleBack}
                onBlock={() => handleBlockUser(selectedConnection.contact.id)}
              />

              {(actionNotice || actionError || sendError) && (
                <div style={{ padding: '10px 16px 0' }}>
                  <InlineNotice
                    message={actionNotice}
                    variant="success"
                    onDismiss={() => setActionNotice(null)}
                  />
                  <InlineNotice
                    message={actionError}
                    variant="error"
                    onDismiss={() => setActionError(null)}
                  />
                  <InlineNotice message={sendError} variant="error" />
                </div>
              )}

              <MessageList
                messages={messages}
                currentUserId={user?.id ?? null}
                peerName={peerName}
                peerTyping={peerTyping}
                loading={messagesLoading}
                error={messagesError}
                onRetry={() => selectedConnectionId && loadMessages(selectedConnectionId)}
              />

              <MessageComposer
                disabled={selectedConnection.status !== 'ACCEPTED'}
                sending={sending}
                onSend={handleSend}
                onTyping={() =>
                  selectedConnectionId && notifyTyping(selectedConnectionId)
                }
              />
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
};

export default Connections;
