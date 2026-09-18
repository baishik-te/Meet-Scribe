import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useSocket } from '../context/SocketContext';

/**
 * Payload emitted by the backend on `call:incoming` (see UserController.initiateCall).
 */
interface IncomingCall {
  callId: string;
  roomName: string;
  caller: { id: string; name: string };
}

/**
 * IncomingCallListener — app-wide receiver-side call notification.
 *
 * Mounted inside the Router so it can navigate. When the socket emits
 * `call:incoming`, a ringing banner is shown with Accept / Decline. Accepting
 * calls `POST /user/calls/accept` to transition the call to ACTIVE and obtain a
 * LiveKit token, then navigates into the Call_Room. Declining dismisses the
 * banner locally.
 */
export const IncomingCallListener: React.FC = () => {
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (data: IncomingCall) => {
      setError(null);
      setIncoming(data);
    };

    // If the caller cancels / the call ends before it's answered, clear the banner.
    const handleEnded = () => {
      setIncoming(null);
      setAccepting(false);
    };

    socket.on('call:incoming', handleIncoming);
    socket.on('call:ended', handleEnded);
    socket.on('call:terminated', handleEnded);

    return () => {
      socket.off('call:incoming', handleIncoming);
      socket.off('call:ended', handleEnded);
      socket.off('call:terminated', handleEnded);
    };
  }, [socket]);

  const handleAccept = async () => {
    if (!incoming) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await api.post('/user/calls/accept', { callId: incoming.callId });
      const { call, livekitToken } = res.data.data;
      const roomName = call?.roomName || incoming.roomName;
      setIncoming(null);
      navigate(
        `/call/room?callId=${incoming.callId}&room=${encodeURIComponent(
          roomName
        )}&token=${encodeURIComponent(livekitToken)}`
      );
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Could not join the call. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    setIncoming(null);
    setError(null);
  };

  if (!incoming) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Incoming call"
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 1000,
        width: 320,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--accent-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}
        >
          📹
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {incoming.caller?.name || 'Someone'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Incoming video call…</div>
        </div>
      </div>

      {error && (
        <div className="inline-notice inline-notice--error" role="alert" style={{ fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={handleAccept}
          disabled={accepting}
          style={{
            flex: 1,
            background: 'var(--accent-blue)',
            border: 'none',
            color: '#fff',
            padding: '10px',
            borderRadius: 'var(--radius-pill)',
            cursor: accepting ? 'default' : 'pointer',
            fontWeight: 600,
            opacity: accepting ? 0.7 : 1,
          }}
        >
          {accepting ? 'Joining…' : 'Accept'}
        </button>
        <button
          type="button"
          onClick={handleDecline}
          disabled={accepting}
          style={{
            flex: 1,
            background: 'var(--accent-red, #e5484d)',
            border: 'none',
            color: '#fff',
            padding: '10px',
            borderRadius: 'var(--radius-pill)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
};

export default IncomingCallListener;
