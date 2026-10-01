// PreJoinScreen

import React, { useEffect, useRef } from 'react';
import { useMediaDevices } from '../hooks/useMediaDevices';
import { cameraDisplayLabel, cameraFacing } from '../lib/cameraFacing';
import type { PreJoinConfig } from '../types/viewModels';

// --- Premium SVG Icons ---
const Icons = {
  Camera: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  CameraOff: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v-4l7-5v10l-7-5z"/><path d="M1 1l22 22"/><path d="M16 11V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10"/></svg>,
  Mic: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  MicOff: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
};

export interface PreJoinScreenProps {
  room: string;
  callId: string | null;
  token: string | null;
  onConfirm: (config: PreJoinConfig) => void;
  onCancel?: () => void;
}

export const PreJoinScreen: React.FC<PreJoinScreenProps> = ({
  room,
  callId,
  token,
  onConfirm,
  onCancel,
}) => {
  const {
    state,
    selectCamera,
    selectMic,
    toggleCamera,
    toggleMic,
    retry,
    stop,
  } = useMediaDevices();

  const videoRef = useRef<HTMLVideoElement>(null);

  const cameraLive = state.status === 'granted' && state.cameraEnabled;

  // Attach / detach the preview. Detaching matters as much as attaching: while a
  // camera switch is in flight the hook clears `previewStream`, and the element
  // must drop its reference before the OS will release the camera lock.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (cameraLive && state.previewStream) {
      el.srcObject = state.previewStream;
      return;
    }
    try {
      el.pause();
    } catch {}
    el.srcObject = null;
  }, [cameraLive, state.previewStream]);

  // Facing of the camera that actually opened (reported by the track), falling
  // back to the label of the selected device. Only a confirmed back camera is
  // shown un-mirrored; front and desktop webcams stay mirrored.
  const currentCam = state.cameras.find((c) => c.deviceId === state.selectedCameraId);
  const activeFacing = state.activeFacingMode ?? cameraFacing(currentCam);
  const isBackCamera = activeFacing === 'environment';

  const handleConfirm = () => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {}
    }
    stop();
    const config: PreJoinConfig = {
      callId,
      room,
      token,
      selectedCameraId: state.selectedCameraId,
      selectedMicId: state.selectedMicId,
      cameraFacingMode: activeFacing,
      cameraEnabled: state.cameraEnabled,
      micEnabled: state.micEnabled,
    };
    onConfirm(config);
  };

  const showCameraPicker = state.cameras.length > 1;
  const showMicPicker = state.microphones.length > 1;

  const hasError = state.status === 'denied' || state.status === 'error';
  const requesting = state.status === 'requesting' || state.status === 'idle';

  return (
    <div
      className="app-container"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: 24,
        gap: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div className="top-title" style={{ justifyContent: 'center' }}>
          Ready to join Room: {room}
        </div>

        {/* Live preview surface */}
        <div
          className="video-stage"
          style={{
            aspectRatio: '16 / 9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            aria-label="Camera preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: cameraLive ? 'block' : 'none',
              transform: isBackCamera ? 'none' : 'scaleX(-1)',
            }}
          />
          {!cameraLive && (
            <div
              style={{
                color: 'var(--text-secondary)',
                textAlign: 'center',
                padding: 24,
                fontSize: 15,
              }}
            >
              {requesting
                ? state.cameras.length > 0
                  ? 'Starting camera…'
                  : 'Requesting camera and microphone…'
                : state.status === 'granted'
                ? 'Camera is off'
                : 'Camera preview unavailable'}
            </div>
          )}
        </div>

        {/* Error message + remediation / retry */}
        {hasError && state.error && (
          <div className="inline-notice inline-notice--error" role="alert">
            <span>{state.error.message}</span>
            {state.status === 'error' && (
              <button
                type="button"
                className="admin-btn admin-btn-small"
                style={{ marginLeft: 'auto', flexShrink: 0 }}
                onClick={() => void retry()}
                aria-label="Retry requesting camera and microphone access"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Device pickers — only when more than one input of a type exists */}
        {(showCameraPicker || showMicPicker) && (
          <div className="form-grid" style={{ marginBottom: 0 }}>
            {showCameraPicker && (
              <div className="form-group">
                <label htmlFor="prejoin-camera-select">Camera</label>
                <select
                  id="prejoin-camera-select"
                  className="dark-select"
                  aria-label="Select camera"
                  value={state.selectedCameraId ?? ''}
                  disabled={requesting}
                  onChange={(e) => selectCamera(e.target.value)}
                >
                  {/* On mobile/tablet the list is normalised to back camera
                      first, front camera second, with plain labels. */}
                  {state.cameras.map((cam, i) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cameraDisplayLabel(cam, i, state.cameras)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {showMicPicker && (
              <div className="form-group">
                <label htmlFor="prejoin-mic-select">Microphone</label>
                <select
                  id="prejoin-mic-select"
                  className="dark-select"
                  aria-label="Select microphone"
                  value={state.selectedMicId ?? ''}
                  onChange={(e) => selectMic(e.target.value)}
                >
                  {state.microphones.map((mic, i) => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label || `Microphone ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Camera + mic toggles reflecting current enabled state */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
          <button
            type="button"
            className={`call-toolbar__btn ${
              state.cameraEnabled ? 'call-toolbar__btn--active' : ''
            }`}
            onClick={toggleCamera}
            aria-label={state.cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
            aria-pressed={state.cameraEnabled}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {state.cameraEnabled ? <Icons.Camera /> : <Icons.CameraOff />}
          </button>
          <button
            type="button"
            className={`call-toolbar__btn ${
              state.micEnabled ? 'call-toolbar__btn--active' : ''
            }`}
            onClick={toggleMic}
            aria-label={
              state.micEnabled ? 'Turn microphone off' : 'Turn microphone on'
            }
            aria-pressed={state.micEnabled}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {state.micEnabled ? <Icons.Mic /> : <Icons.MicOff />}
          </button>
        </div>

        {/* Confirm / join or cancel */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 8 }}>
          <button
            type="button"
            className="call-toolbar__btn call-toolbar__btn--danger"
            style={{ width: 'auto', padding: '0 24px', borderRadius: 'var(--radius-md)', fontWeight: 500 }}
            onClick={() => {
              stop();
              onCancel?.();
            }}
            aria-label="Cancel and leave call"
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn"
            style={{ minWidth: 180 }}
            onClick={handleConfirm}
            aria-label="Join the call now"
          >
            Join now
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreJoinScreen;