import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { AppShell } from '../components/AppShell';
import { InlineNotice } from '../components/InlineNotice';
import { useAuth } from '../context/AuthContext';
import { resolvePartner } from '../lib/resolvePartner';
import type { ConnectionVM } from '../types/viewModels';
import '../styles/Meetings.css';

const VideoIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-3v10l-5-3v-4z" />
  </svg>
);

const ArrowIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

const UsersIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const Meetings: React.FC = () => {
  const [connections, setConnections] = useState<ConnectionVM[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [initiatingPartnerId, setInitiatingPartnerId] =
    useState<string | null>(null);
  const [initiateError, setInitiateError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const loadMutualConnections = async () => {
      try {
        setInitialLoading(true);

        const res = await api.get('/user/connections');

        const accepted = res.data.data.connections.filter(
          (c: ConnectionVM) => c.status === 'ACCEPTED'
        );

        setConnections(accepted);
      } catch (err) {
        console.error(err);
      } finally {
        setInitialLoading(false);
      }
    };

    loadMutualConnections();
  }, []);

  const handleStartDirectMeeting = async (partnerId: string) => {
    try {
      setInitiatingPartnerId(partnerId);
      setInitiateError(null);

      const res = await api.post('/user/calls/initiate', {
        receiverId: partnerId,
      });

      const { call, livekitToken } = res.data.data;

      navigate(
        `/call/room?callId=${call.id}&room=${call.roomName}&token=${encodeURIComponent(
          livekitToken
        )}`
      );
    } catch (err: any) {
      setInitiateError(
        err.response?.data?.error?.message ||
          'Cannot start meeting. Please check your token balance.'
      );
    } finally {
      setInitiatingPartnerId(null);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();

    const code = roomCode.trim();

    if (!code) return;

    navigate(`/call/room?room=${encodeURIComponent(code)}`);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <AppShell title="Video Meetings">
      <div className="meetings-page">

        <header className="meetings-header">
          <div className="meetings-header-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              VIDEO CALLING
            </div>

            <h1>Connect face-to-face</h1>

            <p>
              Start or join a secure video meeting with one of your
              connections.
            </p>
          </div>
        </header>

        <InlineNotice
          message={initiateError}
          variant="error"
          onDismiss={() => setInitiateError(null)}
        />

        <section className="meeting-actions">

          <div className="join-card">
            <div className="join-icon">
              <VideoIcon />
            </div>

            <div className="join-content">
              <span className="section-label">
                JOIN AN EXISTING MEETING
              </span>

              <h2>Enter your meeting room</h2>

              <p>
                Paste the room code shared by your contact to join an active
                meeting.
              </p>

              <form onSubmit={handleJoinByCode} className="join-form">
                <label htmlFor="meeting-room-code" className="sr-only">
                  Meeting room code
                </label>

                <input
                  id="meeting-room-code"
                  type="text"
                  placeholder="Enter meeting room ID"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  autoComplete="off"
                />

                <button
                  type="submit"
                  disabled={!roomCode.trim()}
                >
                  Join Meeting
                  <ArrowIcon />
                </button>
              </form>

              <div className="security-note">
                <span>🔒</span>
                Only accepted connections can join private meetings.
              </div>
            </div>
          </div>

          <div className="stats-card">
            <div className="stats-icon">
              <UsersIcon />
            </div>

            <span className="section-label">CONNECTIONS</span>

            <div className="stat-number">
              {connections.length}
            </div>

            <div className="stat-title">
              Accepted connections
            </div>

            <div className="stat-divider" />

            <div className="network-status">
              Private video calls enabled
            </div>
          </div>

        </section>

        <section className="connections-section">

          <div className="connections-header">
            <div>
              <span className="section-label">CONNECTED PEOPLE</span>

              <h2>Your connections</h2>

              <p>
                Start a private video call with an accepted connection.
              </p>
            </div>

            <div className="connection-count">
              {connections.length}{' '}
              {connections.length === 1 ? 'connection' : 'connections'}
            </div>
          </div>

          {initialLoading ? (
            <div className="loading-grid">
              {[1, 2].map((item) => (
                <div className="skeleton-card" key={item}>
                  <div className="skeleton-avatar" />

                  <div className="skeleton-content">
                    <div className="skeleton-line large" />
                    <div className="skeleton-line small" />
                  </div>

                  <div className="skeleton-button" />
                </div>
              ))}
            </div>
          ) : connections.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <UsersIcon />
              </div>

              <h3>No connections yet</h3>

              <p>
                Connect with other users first to start a private video
                meeting.
              </p>

              <button
                className="secondary-button"
                onClick={() => navigate('/connect')}
              >
                Find People
                <ArrowIcon />
              </button>
            </div>
          ) : (
            <div className="connections-grid">
              {connections.map((connection) => {
                const partner = resolvePartner(
                  connection,
                  user?.id ?? ''
                );

                const isConnecting =
                  initiatingPartnerId === partner.id;

                return (
                  <article
                    className="person-card"
                    key={connection.id}
                  >
                    <div className="avatar-wrapper">
                      <div className="avatar">
                        {getInitials(partner.name)}
                      </div>
                    </div>

                    <div className="person-info">
                      <div className="person-name-row">
                        <h3>{partner.name}</h3>

                        <span className="connected-badge">
                          Connected
                        </span>
                      </div>

                      <p>{partner.email}</p>
                    </div>

                    <button
                      className="call-button"
                      disabled={initiatingPartnerId !== null}
                      onClick={() =>
                        handleStartDirectMeeting(partner.id)
                      }
                    >
                      <VideoIcon />

                      {isConnecting
                        ? 'Connecting...'
                        : 'Start Video Call'}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </AppShell>
  );
};