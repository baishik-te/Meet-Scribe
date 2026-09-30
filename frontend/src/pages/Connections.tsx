import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useSocket } from '../context/SocketContext';
import type { ConnectionVM, SearchUserVM } from '../types/viewModels';
import { isValidSearchQuery } from '../lib/connectionActions';
import { Group, Panel, Separator } from 'react-resizable-panels';
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

export const Connections: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryConnectionId = searchParams.get('connectionId');

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

  const { socket } = useSocket();

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

  // Auto-select conversation or request if connectionId is provided in URL query (e.g. from notification click)
  useEffect(() => {
    if (queryConnectionId && connections.length > 0) {
      const match = connections.find((c) => c.id === queryConnectionId);
      if (match) {
        handleSelect(match.id);
      }
    }
  }, [queryConnectionId, connections]);

  // Listen for real-time connection updates so acceptances / requests sync immediately
  useEffect(() => {
    if (!socket) return;
    const handleConnectionEvent = () => {
      loadConnections();
    };

    socket.on('connection:responded', handleConnectionEvent);
    socket.on('connection:requested', handleConnectionEvent);
    socket.on('connection:cancelled', handleConnectionEvent);

    return () => {
      socket.off('connection:responded', handleConnectionEvent);
      socket.off('connection:requested', handleConnectionEvent);
      socket.off('connection:cancelled', handleConnectionEvent);
    };
  }, [socket]);

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
    if (selectedConnection?.status !== 'ACCEPTED') {
      setActionError('Cannot start a call until the connection request is accepted.');
      return;
    }
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

  const handleSend = async (text: string, file?: File | null) => {
    if (!selectedConnectionId) return;
    const ok = await sendMessage(selectedConnectionId, text, file);
    if (ok) loadConnections();
  };

  const handleBack = () => {
    setSelectedConnectionId(null);
    setActiveConnectionId(null);
  };

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const peerName = selectedConnection?.contact.name ?? '';
  const peerTyping = selectedConnectionId ? Boolean(typing[selectedConnectionId]) : false;
  const headerStatus = peerTyping ? 'typing…' : selectedConnection?.contact.email ?? '';

  const sidebarContent = (
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
  );

  const mainContent = (
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
            canCall={selectedConnection.status === 'ACCEPTED'}
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

          {selectedConnection.status === 'PENDING' && (
            <div
              style={{
                margin: '12px 16px',
                padding: '12px 16px',
                background: 'rgba(234, 179, 8, 0.08)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                borderRadius: 'var(--radius-md, 8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap'
              }}
            >
              <div style={{ fontSize: 13, color: '#facc15' }}>
                {selectedConnection.myRole === 'RECEIVER'
                  ? `${peerName} sent you a connection request.`
                  : `Connection request sent to ${peerName}. Waiting for acceptance.`}
              </div>
              {selectedConnection.myRole === 'RECEIVER' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleRespond(selectedConnection.id, 'ACCEPT')}
                    style={{
                      background: '#22c55e',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Accept Request
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespond(selectedConnection.id, 'REJECT')}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-secondary)',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    Decline
                  </button>
                </div>
              )}
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
            disabledPlaceholder={
              selectedConnection.status === 'PENDING'
                ? 'Connection request pending. Messaging is disabled until accepted.'
                : 'Messaging is disabled for this contact.'
            }
            sending={sending}
            onSend={handleSend}
            onTyping={() =>
              selectedConnectionId && notifyTyping(selectedConnectionId)
            }
          />
        </>
      )}
    </section>
  );

  return (
    <AppShell title="Messages">
      {isMobile ? (
        <div className={`msgx msgx--mobile${selectedConnection ? ' msgx--has-active' : ''}`}>
          {!selectedConnection ? sidebarContent : mainContent}
        </div>
      ) : (
        <Group
          orientation="horizontal"
          className={`msgx${selectedConnection ? ' msgx--has-active' : ''}`}
        >
          <Panel
            id="chat-sidebar"
            defaultSize="28%"
            minSize="220px"
            maxSize="500px"
            className="msgx-panel-sidebar"
          >
            {sidebarContent}
          </Panel>

          <Separator className="msgx-resizer" />

          <Panel
            id="chat-main"
            minSize="320px"
            className="msgx-panel-main"
          >
            {mainContent}
          </Panel>
        </Group>
      )}
    </AppShell>
  );
};

export default Connections;
