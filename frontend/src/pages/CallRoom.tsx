// CallRoom — full-screen Teams call surface.
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

// --- Premium SVG Icons ---
const Icons = {
  Flame: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
  Diamond: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z"/></svg>,
  Camera: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  CameraOff: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v-4l7-5v10l-7-5z"/><path d="M1 1l22 22"/><path d="M16 11V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10"/></svg>,
  Mic: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  MicOff: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  ScreenShare: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>,
  Record: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>,
  Chat: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  People: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  HandRaised: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V3a2 2 0 0 0-4 0v9"/><path d="M6 14v-2a2 2 0 1 0-4 0v5.5a8.5 8.5 0 0 0 17 0V11a2 2 0 1 0-4 0v4"/></svg>,
  Smile: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  GalleryView: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" ry="1"/><rect x="14" y="3" width="7" height="7" rx="1" ry="1"/><rect x="14" y="14" width="7" height="7" rx="1" ry="1"/><rect x="3" y="14" width="7" height="7" rx="1" ry="1"/></svg>,
  SpeakerView: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="12" rx="2" ry="2"/><rect x="4" y="18" width="4" height="3" rx="1"/><rect x="10" y="18" width="4" height="3" rx="1"/><rect x="16" y="18" width="4" height="3" rx="1"/></svg>,
  PhoneDown: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-7-7 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>,
  Transcription: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>,
  Note: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Send: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
};

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

 
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);

  const [localParticipant, setLocalParticipant] = useState<Room['localParticipant'] | null>(null);

  const [connectError, setConnectError] = useState<string | null>(null);

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

  const [cameraDisabled, setCameraDisabled] = useState(false);
  const [micDisabled, setMicDisabled] = useState(false);
  const [toolbarError, setToolbarError] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [screenActive, setScreenActive] = useState(false);

  const [terminationMessage, setTerminationMessage] = useState<string | null>(null);
  const terminationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [transcripts, setTranscripts] = useState<Array<{ id: string; sender: string; text: string }>>([]);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: string; text: string; self: boolean }>>([]);
  const [inputText, setInputText] = useState('');


  const roomRef = useRef<Room | null>(null);
  
  const hasConnectedRef = useRef(false);
 
  const intentionalLeaveRef = useRef(false);
  
  const recorderRef = useRef<CallRecorder | null>(null);

  useEffect(() => {
    if (phase !== 'in-call' || !socket) return;

    socket.emit('join:room', initialRoom);
    socket.emit('call:sync_balance', { roomName: initialRoom, callId });

    const handleTerminated = (data: { message: string }) => {
    
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
      }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  // Send beacon to end/leave call immediately if user closes window or tab
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (callId) {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
        const payload = JSON.stringify({ callId, userId: user?.id, reason: 'WINDOW_CLOSED' });
        const blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(`${baseUrl}/user/calls/leave`, blob);
        }
      }
      roomRef.current?.disconnect();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [callId, user]);

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
  }, [callId]);

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


    const syncParticipants = () => {
      setRemoteParticipants(
        Array.from(lkRoom.remoteParticipants.values()).filter(
          (p) => !p.identity?.startsWith('transcriber-')
        )
      );
    };

    const handleLocalTrackChange = () => {
      if (!lkRoom.localParticipant) return;
      const cam = lkRoom.localParticipant.isCameraEnabled;
      const mic = lkRoom.localParticipant.isMicrophoneEnabled;
      const screen = lkRoom.localParticipant.isScreenShareEnabled;
      setToolbar((prev) => ({
        ...prev,
        cameraEnabled: cam,
        micEnabled: mic,
        screenSharing: screen,
      }));
    };

    lkRoom.on(RoomEvent.ParticipantConnected, syncParticipants);
    lkRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
      syncParticipants();
      const remainingRemotes = Array.from(lkRoom.remoteParticipants.values()).filter(
        (p) => !p.identity?.startsWith('transcriber-') && p.identity !== participant?.identity
      );
      if (remainingRemotes.length === 0) {
        setInfoNotice('Other participant has left the call. You are still in the room.');
      }
    });
    lkRoom.on(RoomEvent.TrackSubscribed, syncParticipants);
    lkRoom.on(RoomEvent.TrackUnsubscribed, syncParticipants);
    lkRoom.on(RoomEvent.TrackPublished, syncParticipants);
    lkRoom.on(RoomEvent.TrackUnpublished, syncParticipants);
    lkRoom.on(RoomEvent.LocalTrackPublished, handleLocalTrackChange);
    lkRoom.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackChange);
    lkRoom.on(RoomEvent.TrackMuted, handleLocalTrackChange);
    lkRoom.on(RoomEvent.TrackUnmuted, handleLocalTrackChange);

    lkRoom.on(RoomEvent.Disconnected, () => {
      if (hasConnectedRef.current && intentionalLeaveRef.current) {
        navigate('/dashboard');
      }
    });

    try {
      await lkRoom.connect(livekitUrl, config.token);

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
    } else {
      setCameraDisabled(false);
      setToolbarError(null);
    }
  };

  // Microphone 
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
    } else {
      setMicDisabled(false);
      setToolbarError(null);
    }
  };

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


  const handleToggleRecording = async () => {
    if (!room || !callId) return;

    if (!toolbar.recording) {
      if (!CallRecorder.isSupported()) {
        setToolbarError('Recording is not supported in this browser.');
        return;
      }
      try {
        // Inform backend to enable recording flag and deduct recording rate in billing
        await api.post('/user/calls/recording', { callId, enable: true }).catch((e) => {
          console.warn('[CallRoom] Backend recording toggle error:', e?.message);
        });

        const rec = new CallRecorder(room);
        rec.start();
        recorderRef.current = rec;
        setToolbar((prev) => ({ ...prev, recording: true }));
        setInfoNotice(null);
        setToolbarError(null);
      } catch (err) {
        console.error('Failed to start recording:', err);
        setToolbarError('Could not start recording.');
      }
    } else {
      setToolbar((prev) => ({ ...prev, recording: false }));
      const rec = recorderRef.current;
      recorderRef.current = null;

      // Inform backend that recording has ended
      await api.post('/user/calls/recording', { callId, enable: false }).catch(() => {});

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

  // Transcription 
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

  //  Chat (Requirement 8.10) 
  const toggleChat = () => {
    setToolbar((prev) => ({ ...prev, chatOpen: !prev.chatOpen }));
  };

  //  Local-only controls 
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

  //  Leave 
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
        await api.post('/user/calls/end', { callId, reason: 'USER_ENDED' });
      } catch {
        // Even if the end endpoint fails, still disconnect and navigate away.
      }
    }
    if (room) {
      await room.disconnect();
    }
    navigate('/dashboard');
  };

  const handlePreJoinCancel = async () => {
    intentionalLeaveRef.current = true;
    if (callId) {
      await api.post('/user/calls/end', { callId, reason: 'PREJOIN_CANCEL' }).catch(() => {});
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
          onCancel={handlePreJoinCancel}
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
            <div className="pill-badge" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icons.Flame /> {burnRate} Tokens/min
            </div>
            <div className="pill-badge" style={{ borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icons.Diamond /> Balance: {remainingBalance !== null ? remainingBalance : 'Synchronizing…'}
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
                    paddingBottom: screenActive ? 160 : 96,
                    display: screenActive ? 'block' : 'none',
                    zIndex: 1,
                    pointerEvents: 'none',
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
                    bottom: 104,
                    display: 'flex',
                    gap: 12,
                    zIndex: 10,
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
                style={{
                  position: 'absolute',
                  bottom: 24,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  zIndex: 30,
                  pointerEvents: 'auto',
                }}
              >
                <button
                  type="button"
                  onClick={toggleCamera}
                  className={`call-toolbar__btn${toolbar.cameraEnabled ? ' call-toolbar__btn--active' : ''}`}
                  aria-label={toolbar.cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
                  aria-pressed={toolbar.cameraEnabled}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {toolbar.cameraEnabled ? <Icons.Camera /> : <Icons.CameraOff />}
                </button>

                <button
                  type="button"
                  onClick={toggleMic}
                  className={`call-toolbar__btn${toolbar.micEnabled ? ' call-toolbar__btn--active' : ''}`}
                  aria-label={toolbar.micEnabled ? 'Mute microphone' : 'Unmute microphone'}
                  aria-pressed={toolbar.micEnabled}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {toolbar.micEnabled ? <Icons.Mic /> : <Icons.MicOff />}
                </button>

                <button
                  type="button"
                  onClick={toggleScreen}
                  className={`call-toolbar__btn${toolbar.screenSharing ? ' call-toolbar__btn--active' : ''}`}
                  aria-label={toolbar.screenSharing ? 'Stop sharing screen' : 'Share screen'}
                  aria-pressed={toolbar.screenSharing}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icons.ScreenShare />
                </button>

                <button
                  type="button"
                  onClick={handleToggleRecording}
                  className={`call-toolbar__btn${toolbar.recording ? ' call-toolbar__btn--danger' : ''}`}
                  aria-label={toolbar.recording ? 'Stop recording' : 'Start recording'}
                  aria-pressed={toolbar.recording}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icons.Record />
                </button>

                <button
                  type="button"
                  onClick={toggleChat}
                  className={`call-toolbar__btn${toolbar.chatOpen ? ' call-toolbar__btn--active' : ''}`}
                  aria-label={toolbar.chatOpen ? 'Hide chat panel' : 'Show chat panel'}
                  aria-pressed={toolbar.chatOpen}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icons.Chat />
                </button>

                <button
                  type="button"
                  onClick={togglePeople}
                  className={`call-toolbar__btn${toolbar.peopleOpen ? ' call-toolbar__btn--active' : ''}`}
                  aria-label={toolbar.peopleOpen ? 'Hide participants' : 'Show participants'}
                  aria-pressed={toolbar.peopleOpen}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icons.People />
                </button>

                <button
                  type="button"
                  onClick={toggleRaiseHand}
                  className={`call-toolbar__btn${toolbar.handRaised ? ' call-toolbar__btn--active' : ''}`}
                  aria-label={toolbar.handRaised ? 'Lower hand' : 'Raise hand'}
                  aria-pressed={toolbar.handRaised}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icons.HandRaised />
                </button>

                <button
                  type="button"
                  onClick={toggleReaction}
                  className={`call-toolbar__btn${toolbar.reaction ? ' call-toolbar__btn--active' : ''}`}
                  aria-label="React"
                  aria-pressed={Boolean(toolbar.reaction)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icons.Smile />
                </button>

                <button
                  type="button"
                  onClick={toggleView}
                  className="call-toolbar__btn"
                  aria-label={`Switch to ${toolbar.viewMode === 'gallery' ? 'speaker' : 'gallery'} view`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {toolbar.viewMode === 'gallery' ? <Icons.GalleryView /> : <Icons.SpeakerView />}
                </button>

                <button
                  type="button"
                  onClick={handleEndCall}
                  className="call-toolbar__btn call-toolbar__btn--danger"
                  aria-label="Leave call"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icons.PhoneDown />
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
                  padding: '6px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Icons.Transcription /> {toolbar.transcribing ? 'On' : 'Off'}
              </button>
            </div>

            {/* Upper section — live transcript (whisper bot output) */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 18px 6px', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icons.Note /> Transcript
              </div>
              <div style={{ flex: 1, minHeight: 0, padding: '0 16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {transcripts.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', margin: 'auto' }}>
                    {toolbar.transcribing
                      ? 'Listening… speak to see the live transcript.'
                      : 'Turn on transcription to capture speech.'}
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
                <Icons.Chat /> Chat
              </div>
              <div style={{ flex: 1, minHeight: 0, padding: '0 16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {chatMessages.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', margin: 'auto' }}>
                    No messages yet. Say hi <Icons.Smile />
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
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Icons.Send />
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