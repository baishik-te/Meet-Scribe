// CallRoom — full-screen Teams call surface.
import React, { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, VideoPresets, Track } from 'livekit-client';
import type { RemoteParticipant, VideoCaptureOptions } from 'livekit-client';
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
import {
  HARDWARE_RELEASE_MS,
  cameraFacingFromLabel,
  delay,
  findDeviceIdForFacing,
  findFacingForDeviceId,
  findFlipTargetDeviceId,
} from '../lib/cameraFacing';
import type { PreJoinConfig } from '../types/viewModels';
import type { CallToolbarState } from '../types/media';
import '../styles/CallRoom.css';

// --- Premium SVG Icons ---
const Icons = {
  Flame: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
  Diamond: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z"/></svg>,
  Camera: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  CameraOff: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v-4l7-5v10l-7-5z"/><path d="M1 1l22 22"/><path d="M16 11V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10"/></svg>,
  FlipCamera: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 1.63.49 3.145 1.33 4.418L3 17l4-.5.5 4 1.7-1.7C10.15 21.36 11.04 22 12 22c4.418 0 8-3.582 8-8z"/><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/></svg>,
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
  BackArrow: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Speaker: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>,
  SpeakerOff: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>,
  MoreDots: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/><circle cx="5" cy="12" r="2.2"/></svg>,
  MoreDotsVertical: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>,
  Calendar: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Plus: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  CameraSmall: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Shield: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
};

type CallPhase = 'prejoin' | 'connecting' | 'in-call';

type CameraFacingMode = 'user' | 'environment';

/**
 * Capture options for a LiveKit camera request.
 *
 * `deviceId` is always stated explicitly when known, because LiveKit fills in
 * any key we omit from `videoCaptureDefaults`. A bare `facingMode` string is
 * only an *ideal* constraint that Chrome on Android routinely ignores, so it is
 * sent as `exact` — the cast is needed because LiveKit types the field as a
 * plain string even though it is forwarded straight into the track constraints.
 */
function cameraCaptureOptions(
  deviceId?: string,
  facing?: CameraFacingMode
): VideoCaptureOptions {
  const options: VideoCaptureOptions = { resolution: VideoPresets.h720.resolution };
  if (deviceId) {
    options.deviceId = { exact: deviceId };
  } else if (facing) {
    (options as { facingMode?: unknown }).facingMode = { exact: facing };
  }
  return options;
}

/** Which camera is actually publishing right now, read off the live track. */
function readActiveCamera(room: Room): {
  deviceId?: string;
  facing?: CameraFacingMode;
} {
  const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
  const mediaTrack = publication?.track?.mediaStreamTrack;
  if (!mediaTrack) return {};
  const settings =
    typeof mediaTrack.getSettings === 'function' ? mediaTrack.getSettings() : undefined;
  return {
    deviceId: settings?.deviceId,
    facing:
      (settings?.facingMode as CameraFacingMode | undefined) ??
      cameraFacingFromLabel(mediaTrack.label),
  };
}

/**
 * Fully let go of the camera: stop the underlying MediaStreamTrack, unpublish,
 * then pause so the mobile OS actually drops the hardware lock. Requesting a
 * different lens before this completes is what produces NotReadableError /
 * "in use by another application".
 */
async function releaseCamera(room: Room): Promise<void> {
  try {
    const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
    publication?.track?.mediaStreamTrack?.stop();
    await room.localParticipant.setCameraEnabled(false);
  } catch (err) {
    console.warn('Error while releasing the camera:', err);
  }
  await delay(HARDWARE_RELEASE_MS);
}

/**
 * Try each set of capture options in turn, releasing the hardware between
 * attempts, so a refused constraint can never leave the call with no camera.
 */
async function startCamera(room: Room, candidates: VideoCaptureOptions[]): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < candidates.length; i += 1) {
    try {
      await room.localParticipant.setCameraEnabled(true, candidates[i]);
      return;
    } catch (err) {
      lastError = err;
      console.warn('Camera start attempt failed:', candidates[i], err);
      if (i < candidates.length - 1) {
        await releaseCamera(room);
      }
    }
  }
  throw lastError;
}

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

  // Mobile Teams Experience State & Timer
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false);
  const [mobileOverlayTab, setMobileOverlayTab] = useState<'chat' | 'details'>('chat');
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  // deviceId of the lens currently published, so a flip knows what to move away
  // from even when the track reports no deviceId in its settings.
  const cameraIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (phase !== 'in-call') return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/call/room?room=${initialRoom}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

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

    const handleFeatureUpdated = (data: { recordingEnabled?: boolean; transcriptionEnabled?: boolean }) => {
      setToolbar((prev) => ({
        ...prev,
        recording: typeof data.recordingEnabled === 'boolean' ? data.recordingEnabled : prev.recording,
        transcribing: typeof data.transcriptionEnabled === 'boolean' ? data.transcriptionEnabled : prev.transcribing,
      }));
    };

    socket.on('call:terminated', handleTerminated);
    socket.on('transcription:new', handleTranscription);
    socket.on('call:feature_updated', handleFeatureUpdated);

    return () => {
      socket.off('call:terminated', handleTerminated);
      socket.off('transcription:new', handleTranscription);
      socket.off('call:feature_updated', handleFeatureUpdated);
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
      // Deliberately no deviceId here. LiveKit merges videoCaptureDefaults into
      // every later camera request (filling in keys the call site omits), so a
      // pinned deviceId would make it impossible to ever open a different lens —
      // flipping the camera would either reopen the same one or fail with
      // OverconstrainedError. Every call site below passes its own deviceId.
      videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
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

      hasConnectedRef.current = true;
      roomRef.current = lkRoom;
      setRoom(lkRoom);
      setLocalParticipant(lkRoom.localParticipant);
      syncParticipants();
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
      return;
    }

    // Enable camera & microphone independently with retry and fallback so camera locks do not abort call connection
    let finalCameraEnabled = false;
    let finalMicEnabled = false;

    if (config.cameraEnabled) {
      // Facing comes from the pre-join screen, which reads it off the track that
      // actually opened. Never guess it from the deviceId string.
      const initialFacing: CameraFacingMode =
        config.cameraFacingMode ??
        (await findFacingForDeviceId(config.selectedCameraId)) ??
        'user';
      setFacingMode(initialFacing);

      try {
        // Wait for the mobile OS to release the camera lock held by the preview
        await delay(HARDWARE_RELEASE_MS);
        await startCamera(lkRoom, [
          ...(config.selectedCameraId ? [cameraCaptureOptions(config.selectedCameraId)] : []),
          cameraCaptureOptions(undefined, initialFacing),
          cameraCaptureOptions(),
        ]);

        const active = readActiveCamera(lkRoom);
        cameraIdRef.current = active.deviceId ?? config.selectedCameraId;
        if (active.facing) setFacingMode(active.facing);
        finalCameraEnabled = true;
      } catch (camErr: any) {
        console.warn('Could not enable the camera on join:', camErr);
        setToolbarError(
          'Camera could not be started. You can try turning it on from the toolbar or flipping camera.'
        );
      }
    }

    if (config.micEnabled) {
      try {
        await lkRoom.localParticipant.setMicrophoneEnabled(
          true,
          config.selectedMicId ? { deviceId: config.selectedMicId } : undefined
        );
        finalMicEnabled = true;
      } catch (micErr) {
        console.warn('Could not enable microphone on join:', micErr);
        try {
          await lkRoom.localParticipant.setMicrophoneEnabled(true);
          finalMicEnabled = true;
        } catch (fallbackMicErr) {
          console.warn('Fallback microphone enable failed:', fallbackMicErr);
        }
      }
    }

    setToolbar((prev) => ({
      ...prev,
      cameraEnabled: finalCameraEnabled,
      micEnabled: finalMicEnabled,
    }));
  };

  /**
   * Flip between the front and back camera.
   *
   * 1. Resolve the target deviceId *before* releasing, while labels are intact.
   * 2. Release the current camera and wait for the OS to drop the lock.
   * 3. Open the target lens, with ordered fallbacks so the call never ends up
   *    with a dark tile: exact target device -> exact target facing -> previous
   *    device -> previous facing -> whatever the browser will give us.
   * 4. Report the lens we actually landed on, read back from the live track.
   */
  const switchCamera = async () => {
    if (!room || isSwitchingCamera) return;
    setIsSwitchingCamera(true);
    setToolbarError(null);

    const prevFacingMode = facingMode;
    const targetFacingMode: CameraFacingMode = prevFacingMode === 'user' ? 'environment' : 'user';
    const prevDeviceId = readActiveCamera(room).deviceId ?? cameraIdRef.current;

    try {
      const targetDeviceId = await findFlipTargetDeviceId(prevDeviceId, targetFacingMode);

      await releaseCamera(room);

      await startCamera(room, [
        ...(targetDeviceId ? [cameraCaptureOptions(targetDeviceId)] : []),
        cameraCaptureOptions(undefined, targetFacingMode),
        ...(prevDeviceId ? [cameraCaptureOptions(prevDeviceId)] : []),
        cameraCaptureOptions(undefined, prevFacingMode),
        cameraCaptureOptions(),
      ]);

      const active = readActiveCamera(room);
      cameraIdRef.current = active.deviceId ?? targetDeviceId ?? prevDeviceId;

      const landedOn: CameraFacingMode =
        active.facing ??
        (await findFacingForDeviceId(cameraIdRef.current)) ??
        (cameraIdRef.current && cameraIdRef.current === prevDeviceId
          ? prevFacingMode
          : targetFacingMode);

      setFacingMode(landedOn);
      setToolbar((prev) => ({ ...prev, cameraEnabled: true }));
      setCameraDisabled(false);

      if (landedOn !== targetFacingMode) {
        setToolbarError(
          'This device would not open the other camera, so your previous camera is still on.'
        );
      }
    } catch (err: any) {
      console.error(`Failed to switch to the ${targetFacingMode} camera:`, err);
      const mapped = mapMediaError(err, 'camera');
      setToolbarError(mapped.message);
      setToolbar((prev) => ({ ...prev, cameraEnabled: false }));
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  const toggleCamera = async () => {
    if (!room || isSwitchingCamera) return;
    setToolbarError(null);

    if (toolbar.cameraEnabled) {
      // Turning off: remember the lens, stop the track, then unpublish.
      try {
        cameraIdRef.current = readActiveCamera(room).deviceId ?? cameraIdRef.current;
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (camPub?.track) {
          camPub.track.mediaStreamTrack?.stop();
        }
        await room.localParticipant.setCameraEnabled(false);
        setToolbar((prev) => ({ ...prev, cameraEnabled: false }));
      } catch (err) {
        console.warn('Error turning off camera:', err);
      }
    } else {
      // Turning on: wait for hardware release, then reopen the same lens
      try {
        await delay(HARDWARE_RELEASE_MS);
        const deviceId = cameraIdRef.current ?? (await findDeviceIdForFacing(facingMode));
        await startCamera(room, [
          ...(deviceId ? [cameraCaptureOptions(deviceId)] : []),
          cameraCaptureOptions(undefined, facingMode),
          cameraCaptureOptions(),
        ]);

        const active = readActiveCamera(room);
        cameraIdRef.current = active.deviceId ?? deviceId;
        if (active.facing) setFacingMode(active.facing);
        setToolbar((prev) => ({ ...prev, cameraEnabled: true }));
        setCameraDisabled(false);
      } catch (err) {
        console.warn('Error turning on camera:', err);
        const mapped = mapMediaError(err, 'camera');
        setToolbarError(mapped.message);
      }
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
    if (!room) return;
    const targetCallId = callId || initialRoom;

    if (!toolbar.recording) {
      if (!CallRecorder.isSupported()) {
        setToolbarError('Recording is not supported in this browser.');
        return;
      }
      try {
        // Inform backend to enable recording flag and deduct recording rate in billing
        await api.post('/user/calls/recording', { callId: targetCallId, enable: true }).catch((e) => {
          console.warn('[CallRoom] Backend recording toggle error:', e?.message);
        });

        const rec = new CallRecorder(room);
        rec.start();
        recorderRef.current = rec;
        setToolbar((prev) => ({ ...prev, recording: true }));
        setInfoNotice(null);
        setToolbarError(null);
        if (socket) {
          socket.emit('call:sync_balance', { roomName: initialRoom, callId: targetCallId });
        }
      } catch (err) {
        console.error('Failed to start recording:', err);
        setToolbarError('Could not start recording.');
      }
    } else {
      setToolbar((prev) => ({ ...prev, recording: false }));
      const rec = recorderRef.current;
      recorderRef.current = null;

      // Inform backend that recording has ended
      await api.post('/user/calls/recording', { callId: targetCallId, enable: false }).catch(() => {});
      if (socket) {
        socket.emit('call:sync_balance', { roomName: initialRoom, callId: targetCallId });
      }

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
    const targetCallId = callId || initialRoom;
    const { next, ok } = await toggleWithRollback(
      toolbar.transcribing,
      (target) => api.post('/user/calls/transcription', { callId: targetCallId, enable: target })
    );
    setToolbar((prev) => ({ ...prev, transcribing: next }));
    if (!ok) {
      setToolbarError('Transcription could not be changed. Please try again.');
    } else if (socket) {
      socket.emit('call:sync_balance', { roomName: initialRoom, callId: targetCallId });
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

  if (isMobile) {
    const activeRemote = remoteParticipants[0];
    const meetingTitle = activeRemote?.name || `Meeting with ${user?.name || 'MeetScribe'}`;

    return (
      <div className="teams-mobile-call">
        {/* Full-Screen Video Canvas */}
        <div className="teams-video-canvas">
          {screenActive && room ? (
            <div style={{ width: '100%', height: '100%' }}>
              <ScreenShareView room={room} onActiveChange={setScreenActive} />
            </div>
          ) : activeRemote ? (
            <ParticipantTile
              key={activeRemote.sid}
              participant={activeRemote}
              displayName={activeRemote.name || activeRemote.identity || 'Participant'}
              className="teams-full-video-tile"
              style={{ width: '100%', height: '100%', aspectRatio: 'unset', borderRadius: 0 }}
            />
          ) : localParticipant ? (
            <ParticipantTile
              key={localParticipant.sid || 'local'}
              participant={localParticipant}
              displayName={user?.name || 'You'}
              badgeSuffix="(You)"
              muteAudio
              className="teams-full-video-tile"
              style={{ width: '100%', height: '100%', aspectRatio: 'unset', borderRadius: 0 }}
            />
          ) : (
            <div className="teams-center-avatar-wrap">
              <div className="teams-center-avatar">
                {(user?.name || 'Me').slice(0, 2).toUpperCase()}
              </div>
            </div>
          )}

          {/* Picture-in-Picture Local Self-View (when in 1-on-1 call with remote) */}
          {activeRemote && localParticipant && (
            <div className="teams-mobile-pip">
              <ParticipantTile
                key={localParticipant.sid || 'local-pip'}
                participant={localParticipant}
                displayName={user?.name || 'You'}
                badgeSuffix="(You)"
                muteAudio
                className="teams-full-video-tile"
                style={{ width: '100%', height: '100%', aspectRatio: 'unset', borderRadius: '12px' }}
              />
            </div>
          )}

          {/* Waiting banner if alone */}
          {!screenActive && remoteParticipants.length === 0 && (
            <div style={{ position: 'absolute', top: 76, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '6px 14px', borderRadius: 8, fontSize: 13, zIndex: 20, whiteSpace: 'nowrap' }}>
              Waiting for others to join…
            </div>
          )}

          {/* Inline notifications */}
          {toolbarError && (
            <div style={{ position: 'absolute', top: 76, left: 16, right: 16, zIndex: 40 }}>
              <InlineNotice variant="error" message={toolbarError} onDismiss={() => setToolbarError(null)} />
            </div>
          )}
          {infoNotice && (
            <div style={{ position: 'absolute', top: 76, left: 16, right: 16, zIndex: 40 }}>
              <InlineNotice variant="success" message={infoNotice} onDismiss={() => setInfoNotice(null)} />
            </div>
          )}
          {terminationMessage && (
            <div style={{ position: 'absolute', top: 76, left: 16, right: 16, zIndex: 40 }}>
              <InlineNotice variant="info" message={`${terminationMessage} Returning to dashboard…`} />
            </div>
          )}
        </div>

        {/* Top Header Overlay */}
        <header className="teams-mobile-top-header">
          <div className="teams-top-left">
            <button
              type="button"
              className="teams-header-btn"
              onClick={handleEndCall}
              aria-label="Back to dashboard"
            >
              <Icons.BackArrow />
            </button>
            <div className="teams-title-group">
              <div className="teams-meeting-title" title={meetingTitle}>
                {meetingTitle}
              </div>
              <div className="teams-meeting-timer">
                {formatTimer(elapsedSeconds)} <Icons.Shield />
              </div>
            </div>
          </div>

          <div className="teams-top-right">
            <button
              type="button"
              className="teams-header-btn"
              onClick={switchCamera}
              disabled={isSwitchingCamera || !toolbar.cameraEnabled}
              aria-label="Flip camera"
              title={`Switch to ${facingMode === 'user' ? 'back' : 'front'} camera`}
              style={{ opacity: !toolbar.cameraEnabled ? 0.5 : 1 }}
            >
              <Icons.FlipCamera />
            </button>
            <button
              type="button"
              className="teams-header-btn"
              onClick={() => {
                setMobileOverlayOpen(true);
                setMobileOverlayTab('chat');
              }}
              aria-label="Open chat"
            >
              <Icons.Chat />
            </button>
            <button
              type="button"
              className="teams-header-btn"
              onClick={() => {
                setMobileOverlayOpen(true);
                setMobileOverlayTab('details');
              }}
              aria-label="Open participants and details"
            >
              <Icons.People />
            </button>
          </div>
        </header>

        {/* Floating Bottom Call Controls */}
        <footer className="teams-mobile-bottom-controls">
          <button
            type="button"
            className={`teams-control-btn ${!toolbar.cameraEnabled ? 'teams-control-btn--muted' : ''}`}
            onClick={toggleCamera}
            aria-label={toolbar.cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          >
            {toolbar.cameraEnabled ? <Icons.Camera /> : <Icons.CameraOff />}
          </button>

          <button
            type="button"
            className={`teams-control-btn ${!toolbar.micEnabled ? 'teams-control-btn--muted' : ''}`}
            onClick={toggleMic}
            aria-label={toolbar.micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {toolbar.micEnabled ? <Icons.Mic /> : <Icons.MicOff />}
          </button>

          <button
            type="button"
            className={`teams-control-btn ${speakerMuted ? 'teams-control-btn--muted' : ''}`}
            onClick={() => setSpeakerMuted(!speakerMuted)}
            aria-label={speakerMuted ? 'Unmute speaker' : 'Mute speaker'}
          >
            {speakerMuted ? <Icons.SpeakerOff /> : <Icons.Speaker />}
          </button>

          <button
            type="button"
            className="teams-control-btn"
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            aria-label="More options"
          >
            <Icons.MoreDots />
          </button>

          <button
            type="button"
            className="teams-end-call-btn"
            onClick={handleEndCall}
            aria-label="End call"
          >
            <Icons.PhoneDown />
          </button>
        </footer>

        {/* More Actions Bottom Sheet */}
        {moreMenuOpen && (
          <div className="teams-more-sheet-overlay" onClick={() => setMoreMenuOpen(false)}>
            <div className="teams-more-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="teams-more-sheet-title">Call Options</div>
              <button
                type="button"
                className="teams-more-item"
                disabled={isSwitchingCamera || !toolbar.cameraEnabled}
                onClick={() => {
                  switchCamera();
                  setMoreMenuOpen(false);
                }}
              >
                <Icons.FlipCamera /> {facingMode === 'user' ? 'Switch to Back Camera' : 'Switch to Front Camera'}
              </button>
              <button
                type="button"
                className="teams-more-item"
                onClick={() => {
                  toggleScreen();
                  setMoreMenuOpen(false);
                }}
              >
                <Icons.ScreenShare /> {toolbar.screenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
              </button>
              <button
                type="button"
                className="teams-more-item"
                onClick={() => {
                  handleToggleRecording();
                  setMoreMenuOpen(false);
                }}
              >
                <Icons.Record /> {toolbar.recording ? 'Stop Recording' : 'Start Recording'}
              </button>
              <button
                type="button"
                className="teams-more-item"
                onClick={() => {
                  toggleRaiseHand();
                  setMoreMenuOpen(false);
                }}
              >
                <Icons.HandRaised /> {toolbar.handRaised ? 'Lower Hand' : 'Raise Hand'}
              </button>
              <button
                type="button"
                className="teams-more-item"
                onClick={() => {
                  toggleReaction();
                  setMoreMenuOpen(false);
                }}
              >
                <Icons.Smile /> Send Reaction (👍)
              </button>
              <button
                type="button"
                className="teams-more-item"
                onClick={() => {
                  setMobileOverlayOpen(true);
                  setMobileOverlayTab('details');
                  setMoreMenuOpen(false);
                }}
              >
                <Icons.People /> View Meeting Details & Token Balance
              </button>
            </div>
          </div>
        )}

        {/* Dedicated Chat & Details Full-Screen Overlay */}
        {mobileOverlayOpen && (
          <div className="teams-chat-overlay">
            {/* Top Purple Return Banner */}
            <div className="teams-return-banner" onClick={() => setMobileOverlayOpen(false)}>
              Tap to return to meeting {formatTimer(elapsedSeconds)}
            </div>

            {/* Header Below Banner */}
            <div className="teams-overlay-header">
              <div className="teams-overlay-top-row">
                <button
                  type="button"
                  className="teams-header-btn"
                  onClick={() => setMobileOverlayOpen(false)}
                  aria-label="Back to video"
                >
                  <Icons.BackArrow />
                </button>
                <div className="teams-overlay-info">
                  <div className="teams-cal-icon">
                    <Icons.Calendar />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="teams-overlay-title">{meetingTitle}</div>
                    <div className="teams-overlay-sub">
                      {remoteParticipants.length + 1} participant{remoteParticipants.length > 0 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="teams-header-btn"
                  onClick={() => setMobileOverlayTab(mobileOverlayTab === 'chat' ? 'details' : 'chat')}
                >
                  <Icons.MoreDotsVertical />
                </button>
              </div>

              {/* Exactly two tabs: CHAT and DETAILS */}
              <div className="teams-overlay-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobileOverlayTab === 'chat'}
                  className={`teams-overlay-tab ${mobileOverlayTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setMobileOverlayTab('chat')}
                >
                  CHAT
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobileOverlayTab === 'details'}
                  className={`teams-overlay-tab ${mobileOverlayTab === 'details' ? 'active' : ''}`}
                  onClick={() => setMobileOverlayTab('details')}
                >
                  DETAILS
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            {mobileOverlayTab === 'chat' ? (
              <>
                <div className="teams-overlay-body">
                  <div className="teams-center-avatar-wrap">
                    <div className="teams-center-avatar">
                      {(user?.name || 'BP').slice(0, 2).toUpperCase()}
                    </div>
                  </div>

                  <div className="teams-date-divider">
                    Today {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  <div className="teams-system-event">
                    <Icons.Calendar /> {user?.name || 'Baishik P.'} joined the meeting.
                  </div>

                  <div className="teams-welcome-bubble">
                    Your meeting is created. Meeting link: <a href={`${window.location.origin}/call/room?room=${initialRoom}`}>{`${window.location.origin}/call/room?room=${initialRoom}`}</a>
                  </div>

                  <div className="teams-system-event">
                    <Icons.Camera /> Meeting started
                  </div>

                  {/* Chat Message Feed */}
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`teams-chat-bubble-row ${msg.self ? 'teams-chat-bubble-row--self' : 'teams-chat-bubble-row--other'}`}
                    >
                      <div className={`teams-bubble-sender ${msg.self ? 'teams-bubble-sender--self' : ''}`}>
                        {msg.sender}
                      </div>
                      <div className={`teams-bubble ${msg.self ? 'teams-bubble--self' : 'teams-bubble--other'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Chat Composer Bar */}
                <form className="teams-chat-composer" onSubmit={sendMessage}>
                  <button type="button" className="teams-plus-btn" aria-label="Add attachment or action">
                    <Icons.Plus />
                  </button>

                  <div className="teams-composer-input-wrap">
                    <input
                      type="text"
                      className="teams-composer-input"
                      placeholder="Type a message"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                    />
                    <button type="button" className="teams-composer-action-btn" aria-label="Add emoji">
                      <Icons.Smile />
                    </button>
                    <button type="button" className="teams-composer-action-btn" aria-label="Camera">
                      <Icons.CameraSmall />
                    </button>
                    <button type="button" className="teams-composer-action-btn" aria-label="Microphone">
                      <Icons.Mic />
                    </button>
                  </div>

                  {inputText.trim() && (
                    <button type="submit" className="teams-send-btn" aria-label="Send message">
                      <Icons.Send />
                    </button>
                  )}
                </form>
              </>
            ) : (
              <div className="teams-overlay-body">
                <div className="teams-details-card">
                  <div className="teams-details-label">Meeting Room</div>
                  <div className="teams-details-value">{initialRoom}</div>
                </div>

                <div className="teams-details-card">
                  <div className="teams-details-label">Meeting Link</div>
                  <div className="teams-details-value" style={{ fontSize: 13, marginBottom: 8 }}>
                    {`${window.location.origin}/call/room?room=${initialRoom}`}
                  </div>
                  <button
                    type="button"
                    onClick={copyMeetingLink}
                    style={{
                      background: 'rgba(91, 95, 199, 0.2)',
                      border: '1px solid #5b5fc7',
                      color: '#a5b4fc',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {copiedLink ? '✓ Copied to clipboard' : 'Copy Meeting Link'}
                  </button>
                </div>

                <div className="teams-details-card">
                  <div className="teams-details-label">Call Duration</div>
                  <div className="teams-details-value">{formatTimer(elapsedSeconds)}</div>
                </div>

                <div className="teams-details-card">
                  <div className="teams-details-label">Billing & Token Allocation</div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>Burn Rate</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>
                        {burnRate} Tokens/min
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>Remaining Balance</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#3b82f6' }}>
                        {remainingBalance !== null ? remainingBalance : 'Synchronizing…'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="teams-details-card">
                  <div className="teams-details-label">Participants ({remoteParticipants.length + 1})</div>
                  <div style={{ marginTop: 8 }}>
                    <div className="teams-participant-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#5b5fc7', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                          {(user?.name || 'Me').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{user?.name || 'You'} (You)</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>Host</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 13 }}>
                        {toolbar.micEnabled ? '🎤' : '🔇'} {toolbar.cameraEnabled ? '📹' : '🚫'}
                      </div>
                    </div>

                    {remoteParticipants.map((p) => (
                      <div key={p.sid} className="teams-participant-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3b82f6', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                            {(p.name || p.identity || 'P').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{p.name || p.identity || 'Participant'}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>Participant</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

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