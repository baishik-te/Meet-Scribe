// CallRoom — full-screen Teams call surface.
//
// Phase model: `prejoin` → `connecting` → `in-call`. The LiveKit `Room` is NOT
// created or connected until the user confirms on the `PreJoinScreen`
// (Requirement 7.1). On confirm, the assembled `PreJoinConfig` (selected device
// IDs + enabled flags) is applied to the room:
//   - `enableCameraAndMicrophone()` then `setCameraEnabled` / `setMicrophoneEnabled`
//     honoring `config.cameraEnabled` / `config.micEnabled`, using
//     `selectedCameraId` / `selectedMicId` as capture constraints (Requirement 7.7).
//
// Preserves: `VITE_LIVEKIT_URL || ws://127.0.0.1:7880`, `RoomEvent.TrackSubscribed`
// (attach remote video to the stage, Requirement 8.14), `RoomEvent.Disconnected`
// → `/dashboard`, and a self-view region visually distinct from and
// non-overlapping with the main stage (Requirement 8.15).
//
// Design: section 9 — `CallRoom` redesign; section 8 — `PreJoinScreen` handoff.
// Requirements: 7.1, 7.7, 8.14, 8.15.
import React, { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, VideoPresets } from 'livekit-client';
import type { RemoteParticipant } from 'livekit-client';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { PreJoinScreen } from './PreJoinScreen';
import { InlineNotice } from '../components/InlineNotice';
import { ParticipantTile } from '../components/ParticipantTile';
import { ScreenShareView } from '../components/ScreenShareView';
import { CallRecorder } from '../lib/callRecorder';
import { toggleWithRollback, shouldCallEndEndpoint } from '../lib/callToolbar';
import { mapMediaError } from '../hooks/useMediaDevices';
import type { PreJoinConfig } from '../types/viewModels';
import type { CallToolbarState } from '../types/media';

type CallPhase = 'prejoin' | 'connecting' | 'in-call';

export const CallRoom: React.FC = () => {
  const [searchParams] = useSearchParams();
  const callId = searchParams.get('callId');
  const initialRoom = searchParams.get('room') || 'default-room';
  const initialToken = searchParams.get('token');

  const { user } = useAuth();
  const { socket, remainingBalance, burnRate } = useSocket();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<CallPhase>('prejoin');
  const [room, setRoom] = useState<Room | null>(null);

  // Remote participants currently in the room. Kept in state so the gallery
  // re-renders when peers join/leave; each tile attaches its own tracks.
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);

  // The connected local participant, used to render the self-view tile.
  const [localParticipant, setLocalParticipant] = useState<Room['localParticipant'] | null>(null);

  // Connection failure surfaced on the pre-join screen (e.g. media server down).
  const [connectError, setConnectError] = useState<string | null>(null);

  // Single source of truth for the Call_Toolbar controls (Design section 9).
  // Camera/Mic/Screen/Record/Chat drive real side effects with rollback;
  // Raise/React/People/View are local-only UI state (Requirement 8.11).
  const [toolbar, setToolbar] = useState<CallToolbarState>({
    cameraEnabled: true,
    micEnabled: true,
    screenSharing: false,
    recording: false,
    transcribing: false,
    chatOpen: true,
    handRaised: false,
    reaction: undefined,
    peopleOpen: false,
    viewMode: 'gallery',
  });

  // Controls that are disabled because their device was denied/in-use during
  // the call — the control stays disabled and the call stays connected
  // (Requirements 10.2, 10.4).
  const [cameraDisabled, setCameraDisabled] = useState(false);
  const [micDisabled, setMicDisabled] = useState(false);

  // Non-blocking inline error surface for toolbar failures (replaces alert()).
  const [toolbarError, setToolbarError] = useState<string | null>(null);
  // Non-blocking info surface (e.g. "Recording saved").
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  // True when a screen share is being presented (drives the speaker layout).
  const [screenActive, setScreenActive] = useState(false);

  // Inline surface for a server-initiated `call:terminated` event. When set, the
  // message is shown via InlineNotice (non-blocking, replacing the old alert())
  // and the user is redirected to /dashboard within 3s (Requirements 10.5, 10.6).
  const [terminationMessage, setTerminationMessage] = useState<string | null>(null);
  // Hold the redirect timer so it can be cleared on unmount (no navigate-after-unmount).
  const terminationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Raw chat/transcription entries; `self` is derived per-render from `user`
  // via `toChatMessageVM` (Requirement 9.6) so the list re-classifies if the
  // user identity changes without needing to rewrite stored messages.
  // Live transcriptions (upper panel) arrive from the whisper bot via the
  // `transcription:new` socket event. Chat messages (lower panel) are ephemeral
  // and exchanged peer-to-peer over the LiveKit data channel.
  const [transcripts, setTranscripts] = useState<Array<{ id: string; sender: string; text: string }>>([]);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: string; text: string; self: boolean }>>([]);
  const [inputText, setInputText] = useState('');

  // Hold the connected room across handlers/cleanup without racing setState.
  const roomRef = useRef<Room | null>(null);
  // True only once connect() has succeeded. Guards the Disconnected handler so a
  // failed/aborted initial connect does NOT navigate the user to /dashboard.
  const hasConnectedRef = useRef(false);
  // True when the user (or server) intentionally ends the call, so we know a
  // disconnect should navigate away rather than surface a "lost connection".
  const intentionalLeaveRef = useRef(false);
  // Active client-side meeting recorder (when running). Live transcription is
  // handled server-side by a whisper bot; the toggle just flips the call flag.
  const recorderRef = useRef<CallRecorder | null>(null);

  // Wire socket handlers once we have a connected room. These are preserved
  // from the original implementation (join:room emit, call:terminated,
  // transcription:new). Follow-up task 14.4 will refine call:terminated.
  useEffect(() => {
    if (phase !== 'in-call' || !socket) return;

    socket.emit('join:room', initialRoom);

    const handleTerminated = (data: { message: string }) => {
      // Surface the event message inline (non-blocking) rather than via alert(),
      // then disconnect and navigate to /dashboard within 3s (Req 10.5, 10.6).
      setTerminationMessage(data.message || 'This call has ended.');
      intentionalLeaveRef.current = true;
      roomRef.current?.disconnect();
      if (terminationTimerRef.current) {
        clearTimeout(terminationTimerRef.current);
      }
      terminationTimerRef.current = setTimeout(() => {
        navigate('/dashboard');
      }, 2500);
    };

    const handleTranscription = (data: { transcript: { text: string }; speakerName: string }) => {
      setTranscripts(prev => [...prev, {
        id: Math.random().toString(),
        sender: data.speakerName,
        text: data.transcript.text
      }]);
    };

    socket.on('call:terminated', handleTerminated);
    socket.on('transcription:new', handleTranscription);

    return () => {
      socket.off('call:terminated', handleTerminated);
      socket.off('transcription:new', handleTranscription);
    };
  }, [phase, socket, initialRoom, navigate]);

  // Receive peer chat messages over the LiveKit data channel (ephemeral, not
  // persisted). Kept separate from transcriptions so the two panels don't mix.
  useEffect(() => {
    if (!room) return;
    const decoder = new TextDecoder();
    const handleData = (payload: Uint8Array, participant?: { name?: string }) => {
      try {
        const msg = JSON.parse(decoder.decode(payload));
        if (msg?.type === 'chat' && typeof msg.text === 'string') {
          setChatMessages((prev) => [
            ...prev,
            { id: Math.random().toString(), sender: participant?.name || 'Guest', text: msg.text, self: false },
          ]);
        }
      } catch {
        /* ignore non-chat data packets */
      }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  // Disconnect the room, stop capture, and clear any pending redirect on unmount.
  useEffect(() => {
    return () => {
      recorderRef.current?.stop().catch(() => {});
      recorderRef.current = null;
      roomRef.current?.disconnect();
      if (terminationTimerRef.current) {
        clearTimeout(terminationTimerRef.current);
      }
    };
  }, []);

  // Upload a finished recording blob to the backend (saved under /uploads).
  const uploadRecording = async (blob: Blob, durationSeconds: number) => {
    if (!callId) return;
    const form = new FormData();
    const startedAt = new Date(Date.now() - durationSeconds * 1000).toISOString();
    form.append('recording', blob, `recording-${Date.now()}.webm`);
    form.append('durationSeconds', String(durationSeconds));
    form.append('startedAt', startedAt);
    await api.post(`/user/calls/${callId}/recording/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  };

  // Confirm handoff from PreJoinScreen: create the room, connect, and apply the
  // selected devices + enabled flags (Requirements 7.1, 7.7).
  const handlePreJoinConfirm = async (config: PreJoinConfig) => {
    if (!config.token) {
      setConnectError('Cannot join call: the video session token is missing. Please start the call again.');
      return;
    }

    setConnectError(null);
    setPhase('connecting');

    // Use ws://127.0.0.1:7880 for local development (preserved).
    const livekitUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://127.0.0.1:7880';

    const lkRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
        deviceId: config.selectedCameraId
      },
      audioCaptureDefaults: {
        deviceId: config.selectedMicId
      }
    });

    // Keep the participant gallery in sync with the room roster. Each of these
    // events changes who is present or which of their tracks exist; the tiles
    // themselves attach the actual media.
    const syncParticipants = () => {
      // Hide the server-side transcription bot (identity `transcriber-<callId>`)
      // — it subscribes to audio only and should not appear as a participant.
      setRemoteParticipants(
        Array.from(lkRoom.remoteParticipants.values()).filter(
          (p) => !p.identity?.startsWith('transcriber-')
        )
      );
    };

    lkRoom.on(RoomEvent.ParticipantConnected, syncParticipants);
    lkRoom.on(RoomEvent.ParticipantDisconnected, syncParticipants);
    lkRoom.on(RoomEvent.TrackSubscribed, syncParticipants);
    lkRoom.on(RoomEvent.TrackUnsubscribed, syncParticipants);
    lkRoom.on(RoomEvent.TrackPublished, syncParticipants);
    lkRoom.on(RoomEvent.TrackUnpublished, syncParticipants);

    lkRoom.on(RoomEvent.Disconnected, () => {
      // A failed/aborted initial connect also fires Disconnected. Only leave the
      // page when we had actually connected AND the disconnect was intentional
      // (user pressed Leave, or the server terminated the call). Otherwise stay
      // and let the user retry from the pre-join screen.
      if (hasConnectedRef.current && intentionalLeaveRef.current) {
        navigate('/dashboard');
      }
    });

    try {
      await lkRoom.connect(livekitUrl, config.token);

      // Acquire camera + mic, then honor the pre-join selections using the
      // chosen device IDs as capture constraints (Requirement 7.7).
      await lkRoom.localParticipant.enableCameraAndMicrophone();
      await lkRoom.localParticipant.setCameraEnabled(
        config.cameraEnabled,
        config.selectedCameraId ? { deviceId: config.selectedCameraId } : undefined
      );
      await lkRoom.localParticipant.setMicrophoneEnabled(
        config.micEnabled,
        config.selectedMicId ? { deviceId: config.selectedMicId } : undefined
      );

      hasConnectedRef.current = true;
      roomRef.current = lkRoom;
      setRoom(lkRoom);
      setLocalParticipant(lkRoom.localParticipant);
      syncParticipants();
      setToolbar((prev) => ({
        ...prev,
        cameraEnabled: config.cameraEnabled,
        micEnabled: config.micEnabled,
      }));
      setPhase('in-call');
    } catch (err) {
      console.error('Failed to connect to LiveKit server:', err);
      // Detach handlers and tear down the half-open room WITHOUT navigating away.
      lkRoom.removeAllListeners();
      await lkRoom.disconnect();
      setConnectError(
        'Could not connect to the video server. Make sure the call is still active and try again.'
      );
      setPhase('prejoin');
    }
  };

  // ── Camera (Requirements 8.2, 8.3, 10.1, 10.2, 10.4) ──
  // On SUCCESS the control flips to `!s`; on FAILURE it stays `s` and an inline
  // error is raised. Denied/in-use → keep the control disabled, keep connected.
  const toggleCamera = async () => {
    if (!room) return;
    const { next, ok, error } = await toggleWithRollback(
      toolbar.cameraEnabled,
      (target) => room.localParticipant.setCameraEnabled(target)
    );
    setToolbar((prev) => ({ ...prev, cameraEnabled: next }));
    if (!ok) {
      const mapped = mapMediaError(error, 'camera');
      setToolbarError(mapped.message);
      if (mapped.kind === 'denied' || mapped.kind === 'inUse') {
        setCameraDisabled(true);
      }
    }
  };

  // ── Microphone (Requirements 8.4, 8.5, 10.1, 10.2, 10.4) ──
  const toggleMic = async () => {
    if (!room) return;
    const { next, ok, error } = await toggleWithRollback(
      toolbar.micEnabled,
      (target) => room.localParticipant.setMicrophoneEnabled(target)
    );
    setToolbar((prev) => ({ ...prev, micEnabled: next }));
    if (!ok) {
      const mapped = mapMediaError(error, 'microphone');
      setToolbarError(mapped.message);
      if (mapped.kind === 'denied' || mapped.kind === 'inUse') {
        setMicDisabled(true);
      }
    }
  };

  // ── Screen Share (Requirements 8.6, 8.7, 10.3) ──
  // Cancel/deny keeps the inactive state + message; the call stays connected.
  const toggleScreen = async () => {
    if (!room) return;
    const { next, ok, error } = await toggleWithRollback(
      toolbar.screenSharing,
      (target) => room.localParticipant.setScreenShareEnabled(target)
    );
    setToolbar((prev) => ({ ...prev, screenSharing: next }));
    if (!ok) {
      const mapped = mapMediaError(error, 'screen');
      setToolbarError(mapped.message);
    }
  };

  // ── Record (Requirements 8.8, 8.9) ──
  // Client-side capture: composite all camera/screen video + mixed audio into a
  // single WebM via MediaRecorder, then upload to /uploads on stop.
  const handleToggleRecording = async () => {
    if (!room || !callId) return;

    if (!toolbar.recording) {
      if (!CallRecorder.isSupported()) {
        setToolbarError('Recording is not supported in this browser.');
        return;
      }
      try {
        const rec = new CallRecorder(room);
        rec.start();
        recorderRef.current = rec;
        setToolbar((prev) => ({ ...prev, recording: true }));
        setInfoNotice(null);
      } catch (err) {
        console.error('Failed to start recording:', err);
        setToolbarError('Could not start recording.');
      }
    } else {
      setToolbar((prev) => ({ ...prev, recording: false }));
      const rec = recorderRef.current;
      recorderRef.current = null;
      if (!rec) return;
      try {
        setInfoNotice('Saving recording…');
        const { blob, durationSeconds } = await rec.stop();
        await uploadRecording(blob, durationSeconds);
        setInfoNotice('Recording saved to your library.');
      } catch (err) {
        console.error('Failed to save recording:', err);
        setInfoNotice(null);
        setToolbarError('Could not save the recording.');
      }
    }
  };

  // ── Transcription (Requirement 9.4) ──
  // Flips the server flag; the backend starts/stops a local whisper.cpp bot that
  // joins the room, transcribes everyone's audio, and broadcasts results live
  // via the `transcription:new` socket event (handled above).
  const handleToggleTranscription = async () => {
    if (!callId) return;
    const { next, ok } = await toggleWithRollback(
      toolbar.transcribing,
      (target) => api.post('/user/calls/transcription', { callId, enable: target })
    );
    setToolbar((prev) => ({ ...prev, transcribing: next }));
    if (!ok) {
      setToolbarError('Transcription could not be changed. Please try again.');
    }
  };

  // ── Chat (Requirement 8.10) — toggle Meeting_Panel visibility, cannot fail. ──
  const toggleChat = () => {
    setToolbar((prev) => ({ ...prev, chatOpen: !prev.chatOpen }));
  };

  // ── Local-only controls (Requirement 8.11) — no backend endpoints. ──
  const toggleRaiseHand = () => {
    setToolbar((prev) => ({ ...prev, handRaised: !prev.handRaised }));
  };

  const toggleReaction = () => {
    setToolbar((prev) => ({ ...prev, reaction: prev.reaction ? undefined : '👍' }));
  };

  const togglePeople = () => {
    setToolbar((prev) => ({ ...prev, peopleOpen: !prev.peopleOpen }));
  };

  const toggleView = () => {
    setToolbar((prev) => ({
      ...prev,
      viewMode: prev.viewMode === 'gallery' ? 'speaker' : 'gallery',
    }));
  };

  // ── Leave (Requirements 8.12, 8.13 / Property 8) ──
  // POST /user/calls/end iff a callId is present; always disconnect + navigate.
  const handleEndCall = async () => {
    intentionalLeaveRef.current = true;

    // If a recording is in progress, finalize and upload it before leaving.
    if (recorderRef.current) {
      const rec = recorderRef.current;
      recorderRef.current = null;
      try {
        const { blob, durationSeconds } = await rec.stop();
        await uploadRecording(blob, durationSeconds);
      } catch (err) {
        console.error('Failed to save recording on leave:', err);
      }
    }

    if (shouldCallEndEndpoint(callId)) {
      try {
        await api.post('/user/calls/end', { callId });
      } catch {
        // Even if the end endpoint fails, still disconnect and navigate away.
      }
    }
    if (room) {
      await room.disconnect();
    }
    navigate('/dashboard');
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !room) return;

    // Broadcast to the other participants over the LiveKit data channel.
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ type: 'chat', text }));
      await room.localParticipant.publishData(payload, { reliable: true });
    } catch (err) {
      console.error('Failed to send chat message:', err);
    }

    // Optimistically show our own message.
    setChatMessages((prev) => [
      ...prev,
      { id: Math.random().toString(), sender: user?.name || 'You', text, self: true },
    ]);
    setInputText('');
  };

  // ── Phase: prejoin ── render the media-check surface; do NOT connect yet.
  if (phase === 'prejoin') {
    return (
      <>
        {connectError && (
          <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', maxWidth: 480, zIndex: 1000 }}>
            <InlineNotice
              variant="error"
              message={connectError}
              onDismiss={() => setConnectError(null)}
            />
          </div>
        )}
        <PreJoinScreen
          room={initialRoom}
          callId={callId}
          token={initialToken}
          onConfirm={handlePreJoinConfirm}
        />
      </>
    );
  }

  // ── Phase: connecting ── brief transitional surface while the room connects.
  if (phase === 'connecting') {
    return (
      <div
        className="app-container"
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div className="top-title">Connecting to Room: {initialRoom}…</div>
        <div style={{ color: 'var(--text-secondary)' }}>Setting up your camera and microphone.</div>
      </div>
    );
  }

  // ── Phase: in-call ── full call surface (toolbar/chat/indicators preserved).
  // Tile count drives the gallery column count (self-view + remote peers).
  const totalTiles = (localParticipant ? 1 : 0) + remoteParticipants.length;
  const galleryColumns = totalTiles <= 1 ? 1 : totalTiles <= 4 ? 2 : totalTiles <= 9 ? 3 : 4;

  return (
    <div className="app-container">
      <div className="main-viewport">
        {/* Top Meeting Header */}
        <div className="top-bar">
          <div className="top-title">
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>←</span>
            <span>Room: {initialRoom}</span>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="pill-badge">
              🔥 {burnRate} Tokens/min
            </div>
            <div className="pill-badge" style={{ borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}>
              💎 Balance: {remainingBalance !== null ? remainingBalance : 'Synchronizing…'}
            </div>
          </div>
        </div>

        {/* Meeting Layout Stage */}
        <div style={{ display: 'flex', flex: 1, gap: 20, minHeight: 0 }}>
          {/* Main Video Presentation Canvas */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              flex: 1,
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Screen-share layer — always mounted so a share is detected the
                  moment it starts; shown large on the stage when active. */}
              {room && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    padding: 16,
                    paddingBottom: screenActive ? 150 : 96,
                    display: screenActive ? 'block' : 'none',
                    zIndex: 1,
                  }}
                >
                  <ScreenShareView room={room} onActiveChange={setScreenActive} />
                </div>
              )}

              {screenActive ? (
                /* Speaker layout: the screen share fills the stage; participants
                   ride in a compact strip above the toolbar. */
                <div
                  style={{
                    position: 'absolute',
                    left: 16,
                    right: 16,
                    bottom: 92,
                    display: 'flex',
                    gap: 12,
                    zIndex: 2,
                    overflowX: 'auto',
                    paddingBottom: 4,
                  }}
                >
                  {localParticipant && (
                    <div style={{ width: 170, flex: '0 0 auto' }}>
                      <ParticipantTile
                        key={localParticipant.sid || 'local'}
                        participant={localParticipant}
                        displayName={user?.name || 'You'}
                        badgeSuffix="(You)"
                        muteAudio
                      />
                    </div>
                  )}
                  {remoteParticipants.map((p) => (
                    <div key={p.sid} style={{ width: 170, flex: '0 0 auto' }}>
                      <ParticipantTile
                        participant={p}
                        displayName={p.name || p.identity || 'Participant'}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                /* Gallery layout — self-view + every remote participant. Each
                   tile attaches its own camera AND microphone tracks. */
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    padding: 16,
                    paddingBottom: 96, // leave clearance for the overlaid toolbar
                    display: 'grid',
                    gap: 12,
                    gridTemplateColumns: `repeat(${galleryColumns}, minmax(0, 1fr))`,
                    alignContent: 'center',
                    justifyContent: 'center',
                    overflowY: 'auto',
                  }}
                >
                  {localParticipant && (
                    <ParticipantTile
                      key={localParticipant.sid || 'local'}
                      participant={localParticipant}
                      displayName={user?.name || 'You'}
                      badgeSuffix="(You)"
                      muteAudio
                    />
                  )}
                  {remoteParticipants.map((p) => (
                    <ParticipantTile
                      key={p.sid}
                      participant={p}
                      displayName={p.name || p.identity || 'Participant'}
                    />
                  ))}
                </div>
              )}

              {!screenActive && remoteParticipants.length === 0 && (
                <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.55)', padding: '6px 14px', borderRadius: 8, fontSize: 14, zIndex: 1 }}>
                  Waiting for others to join…
                </div>
              )}

              {/* Inline error surface for toolbar failures (non-blocking). */}
              {toolbarError && (
                <div style={{ position: 'absolute', top: 16, right: 16, maxWidth: 360, zIndex: 3 }}>
                  <InlineNotice
                    variant="error"
                    message={toolbarError}
                    onDismiss={() => setToolbarError(null)}
                  />
                </div>
              )}

              {/* Inline info surface (e.g. recording saved). */}
              {infoNotice && (
                <div style={{ position: 'absolute', top: 16, right: 16, maxWidth: 360, zIndex: 3 }}>
                  <InlineNotice
                    variant="success"
                    message={infoNotice}
                    onDismiss={() => setInfoNotice(null)}
                  />
                </div>
              )}

              {/* Server-initiated call termination (Req 10.5, 10.6). Shown inline
                  and non-blocking; the effect above disconnects and redirects to
                  /dashboard within 3s. No dismiss — the redirect resolves it. */}
              {terminationMessage && (
                <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', maxWidth: 420, zIndex: 3 }}>
                  <InlineNotice
                    variant="info"
                    message={`${terminationMessage} Returning to your dashboard…`}
                  />
                </div>
              )}

              {/* Teams-style Call_Toolbar (Requirements 8.1, 8.16, 13.3). All
                  colors/radii come from theme tokens via the `.call-toolbar`
                  classes; each control exposes an aria-label. */}
              <div
                className="call-toolbar"
                role="toolbar"
                aria-label="Call controls"
                style={{ position: 'absolute', bottom: 24 }}
              >
                <button
                  type="button"
                  onClick={toggleCamera}
                  disabled={cameraDisabled}
                  className={`call-toolbar__btn${toolbar.cameraEnabled && !cameraDisabled ? ' call-toolbar__btn--active' : ''}`}
                  aria-label={toolbar.cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
                  aria-pressed={toolbar.cameraEnabled}
                >
                  {toolbar.cameraEnabled ? '📷' : '🚫'}
                </button>

                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={micDisabled}
                  className={`call-toolbar__btn${toolbar.micEnabled && !micDisabled ? ' call-toolbar__btn--active' : ''}`}
                  aria-label={toolbar.micEnabled ? 'Mute microphone' : 'Unmute microphone'}
                  aria-pressed={toolbar.micEnabled}
                >
                  {toolbar.micEnabled ? '🎤' : '🔇'}
                </button>

                <button
                  type="button"
                  onClick={toggleScreen}
                  className={`call-toolbar__btn${toolbar.screenSharing ? ' call-toolbar__btn--active' : ''}`}
                  aria-label={toolbar.screenSharing ? 'Stop sharing screen' : 'Share screen'}
                  aria-pressed={toolbar.screenSharing}
                >
                  🖥
                </button>

                <button
                  type="button"
                  onClick={handleToggleRecording}
                  className={`call-toolbar__btn${toolbar.recording ? ' call-toolbar__btn--danger' : ''}`}
                  aria-label={toolbar.recording ? 'Stop recording' : 'Start recording'}
                  aria-pressed={toolbar.recording}
                >
                  ⏺
                </button>

                <button
                  type="button"
                  onClick={toggleChat}
                  className={`call-toolbar__btn${toolbar.chatOpen ? ' call-toolbar__btn--active' : ''}`}
                  aria-label={toolbar.chatOpen ? 'Hide chat panel' : 'Show chat panel'}
                  aria-pressed={toolbar.chatOpen}
                >
                  💬
                </button>

                <button
                  type="button"
                  onClick={togglePeople}
                  className={`call-toolbar__btn${toolbar.peopleOpen ? ' call-toolbar__btn--active' : ''}`}
                  aria-label={toolbar.peopleOpen ? 'Hide participants' : 'Show participants'}
                  aria-pressed={toolbar.peopleOpen}
                >
                  👥
                </button>

                <button
                  type="button"
                  onClick={toggleRaiseHand}
                  className={`call-toolbar__btn${toolbar.handRaised ? ' call-toolbar__btn--active' : ''}`}
                  aria-label={toolbar.handRaised ? 'Lower hand' : 'Raise hand'}
                  aria-pressed={toolbar.handRaised}
                >
                  ✋
                </button>

                <button
                  type="button"
                  onClick={toggleReaction}
                  className={`call-toolbar__btn${toolbar.reaction ? ' call-toolbar__btn--active' : ''}`}
                  aria-label="React"
                  aria-pressed={Boolean(toolbar.reaction)}
                >
                  😊
                </button>

                <button
                  type="button"
                  onClick={toggleView}
                  className="call-toolbar__btn"
                  aria-label={`Switch to ${toolbar.viewMode === 'gallery' ? 'speaker' : 'gallery'} view`}
                >
                  {toolbar.viewMode === 'gallery' ? '🖼' : '🔲'}
                </button>

                <button
                  type="button"
                  onClick={handleEndCall}
                  className="call-toolbar__btn call-toolbar__btn--danger"
                  aria-label="Leave call"
                >
                  📞
                </button>
              </div>
            </div>

          </div>

          {/* Right Chat & Live Transcription Sidebar (Meeting_Panel).
              Visibility is toggled by the Chat control (Requirement 8.10). */}
          {toolbar.chatOpen && (
          <div style={{
            width: 340,
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--border-color)'
          }}>
            {/* Panel header + live-transcription toggle */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Live Transcripts &amp; Chat</span>
              <button
                type="button"
                onClick={handleToggleTranscription}
                aria-label={toolbar.transcribing ? 'Stop live transcription' : 'Start live transcription'}
                aria-pressed={toolbar.transcribing}
                style={{
                  background: toolbar.transcribing ? 'var(--accent-blue)' : 'var(--bg-card-secondary)',
                  border: '1px solid var(--border-color)',
                  color: '#fff',
                  borderRadius: 'var(--radius-pill)',
                  padding: '4px 12px',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                🎙 {toolbar.transcribing ? 'On' : 'Off'}
              </button>
            </div>

            {/* Upper section — live transcript (whisper bot output) */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 18px 6px', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                📝 Transcript
              </div>
              <div style={{ flex: 1, minHeight: 0, padding: '0 16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {transcripts.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', margin: 'auto' }}>
                    {toolbar.transcribing
                      ? 'Listening… speak to see the live transcript.'
                      : 'Turn on transcription (🎙) to capture speech.'}
                  </div>
                ) : (
                  transcripts.map((t) => (
                    <div key={t.id}>
                      <div style={{ fontSize: 11, color: 'var(--accent-blue)', marginBottom: 2 }}>{t.sender}</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4 }}>{t.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Lower section — chat (peer-to-peer via LiveKit data channel) */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: '2px solid var(--border-color)' }}>
              <div style={{ padding: '10px 18px 6px', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                💬 Chat
              </div>
              <div style={{ flex: 1, minHeight: 0, padding: '0 16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {chatMessages.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', margin: 'auto' }}>
                    No messages yet. Say hi 👋
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} style={{ alignSelf: msg.self ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2, textAlign: msg.self ? 'right' : 'left' }}>
                        {msg.sender}
                      </div>
                      <div className={msg.self ? 'msg--self' : 'msg--other'}>{msg.text}</div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={sendMessage} style={{ padding: 14, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Send a message…"
                  style={{
                    flex: 1,
                    background: 'var(--bg-card-secondary)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    borderRadius: 'var(--radius-pill)',
                    padding: '10px 16px',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: 'var(--accent-blue)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 40,
                    height: 40,
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  ➤
                </button>
              </form>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
