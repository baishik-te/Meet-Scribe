import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { AppShell } from '../components/AppShell';
import { InlineNotice } from '../components/InlineNotice';
import type { ConnectionVM } from '../types/viewModels';

export const Meetings: React.FC = () => {
  const [connections, setConnections] = useState<ConnectionVM[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [initiateError, setInitiateError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadMutualConnections = async () => {
      try {
        const res = await api.get('/user/connections');
        const accepted = res.data.data.connections.filter(
          (c: ConnectionVM) => c.status === 'ACCEPTED'
        );
        setConnections(accepted);
      } catch (err) {
        console.error(err);
      }
    };
    loadMutualConnections();
  }, []);

  const handleStartDirectMeeting = async (partnerId: string) => {
    try {
      setLoading(true);
      setInitiateError(null);
      const res = await api.post('/user/calls/initiate', { receiverId: partnerId });
      const { call, livekitToken } = res.data.data;
      navigate(`/call/room?callId=${call.id}&room=${call.roomName}&token=${encodeURIComponent(livekitToken)}`);
    } catch (err: any) {
      setInitiateError(err.response?.data?.error?.message || 'Cannot start meeting. Check token balance.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    navigate(`/call/room?room=${encodeURIComponent(roomCode.trim())}`);
  };

  return (
    <AppShell title="Video Meetings">
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
        Calls are strictly authorized with mutual accepted connections. Dynamic token rates apply.
      </p>

      {/* Join existing room by code */}
      <section style={{
        background: 'var(--bg-card)',
        padding: 24,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        marginBottom: 28,
        maxWidth: 640
      }}>
        <h3 style={{ marginTop: 0 }}>Join with Room Code</h3>
        <form onSubmit={handleJoinByCode} style={{ display: 'flex', gap: 12 }}>
          <input
            type="text"
            placeholder="Enter meeting room ID..."
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--bg-card-secondary)',
              border: '1px solid var(--border-color)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              color: '#fff'
            }}
          />
          <button
            type="submit"
            style={{
              background: 'var(--accent-blue)',
              border: 'none',
              color: '#fff',
              padding: '0 24px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Join Meeting
          </button>
        </form>
      </section>

      {/* Start Instant Meeting with Connected Peers */}
      <section style={{
        background: 'var(--bg-card)',
        padding: 24,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        maxWidth: 800
      }}>
        <h3 style={{ marginTop: 0 }}>Connected Users Available for Video Calls</h3>

        <InlineNotice
          message={initiateError}
          variant="error"
          onDismiss={() => setInitiateError(null)}
        />

        {connections.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>
            No mutual connections found. Head over to the <strong>Connect</strong> tab to search for users by email and connect first.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {connections.map((c) => {
              const partner = c.requester!.id === c.receiverId ? c.receiver! : c.requester!;
              return (
                <div
                  key={c.id}
                  style={{
                    background: 'var(--bg-card-secondary)',
                    padding: 16,
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{partner.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{partner.email}</div>
                  <button
                    disabled={loading}
                    onClick={() => handleStartDirectMeeting(partner.id)}
                    style={{
                      marginTop: 8,
                      background: 'var(--accent-blue)',
                      border: 'none',
                      color: '#fff',
                      padding: '10px',
                      borderRadius: 'var(--radius-pill)',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {loading ? 'Connecting...' : '📹 Start Video Call'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
};
