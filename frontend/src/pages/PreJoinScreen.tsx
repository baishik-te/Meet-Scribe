// PreJoinScreen — the media check surface shown before LiveKit connects.
//
// Renders a live camera preview, camera/mic toggles, and (when more than one
// input device of a type exists) device pickers. On denied/in-use/unavailable
// it surfaces the mapped `MediaError` message + a retry control and stays on
// the screen. On confirm it stops the preview tracks and hands a
// `PreJoinConfig` (selected device IDs + enabled flags) to the caller.
//
// Design: section 8 — `PreJoinScreen` + `useMediaDevices` hook.
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8.
import React, { useEffect, useRef } from 'react';
import { useMediaDevices } from '../hooks/useMediaDevices';
import type { PreJoinConfig } from '../types/viewModels';

export interface PreJoinScreenProps {
  /** Room name the call will connect to. */
  room: string;
  /** Backend call id, when already created. */
  callId: string | null;
  /** LiveKit access token, when already issued. */
  token: string | null;
  /** Invoked with the assembled config after preview tracks are stopped. */
  onConfirm: (config: PreJoinConfig) => void;
}

/**
 * PreJoinScreen — see module docblock. Owns no media logic itself; it drives
 * the `useMediaDevices` hook and reflects its state (Requirement 7.1).
 */
export const PreJoinScreen: React.FC<PreJoinScreenProps> = ({
  room,
  callId,
  token,
  onConfirm,
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

  // Attach the preview stream to the <video> whenever the camera is live and a
  // stream is available; detach otherwise (Requirement 7.3).
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (cameraLive && state.previewStream) {
      el.srcObject = state.previewStream;
    } else {
      el.srcObject = null;
    }
  }, [cameraLive, state.previewStream]);

  const handleConfirm = () => {
    // Stop preview tracks before handing off so the call can re-acquire the
    // selected devices cleanly (Requirement 7.7).
    stop();
    const config: PreJoinConfig = {
      callId,
      room,
      token,
      selectedCameraId: state.selectedCameraId,
      selectedMicId: state.selectedMicId,
      cameraEnabled: state.cameraEnabled,
      micEnabled: state.micEnabled,
    };
    onConfirm(config);
  };

  const showCameraPicker = state.cameras.length > 1;
  const showMicPicker = state.microphones.length > 1;

  // Denied stays on screen with remediation steps (Requirement 7.5). In-use /
  // unavailable / not-found show a message + retry (Requirement 7.6).
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
              transform: 'scaleX(-1)',
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
                ? 'Requesting camera and microphone…'
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
                  onChange={(e) => selectCamera(e.target.value)}
                >
                  {state.cameras.map((cam, i) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label || `Camera ${i + 1}`}
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
          >
            {state.cameraEnabled ? '📷' : '🚫'}
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
          >
            {state.micEnabled ? '🎤' : '🔇'}
          </button>
        </div>

        {/* Confirm / join */}
        <button
          type="button"
          className="admin-btn"
          style={{ alignSelf: 'center', minWidth: 200 }}
          onClick={handleConfirm}
          aria-label="Join the call now"
        >
          Join now
        </button>
      </div>
    </div>
  );
};

export default PreJoinScreen;
