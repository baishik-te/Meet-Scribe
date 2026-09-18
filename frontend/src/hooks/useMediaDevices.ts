// useMediaDevices — centralizes the browser Media Capture APIs for the
// pre-join flow and in-call media handling.
//
// Owns the `MediaDeviceState` (status, device lists, selections, toggle flags,
// preview stream and any mapped error) and exposes actions to request a
// preview, enumerate devices, pick a specific camera/mic, toggle each track,
// retry after a failure, and stop/clean up tracks.
//
// Browser DOMExceptions are translated into user-facing `MediaError`s via the
// exported `mapMediaError` helper so callers can render a device name plus
// remediation steps.
//
// Design: section 8 — `PreJoinScreen` + `useMediaDevices` hook.
// Requirements: 7.2, 7.4, 7.5, 7.6, 7.8, 10.2, 10.3, 10.4.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaDeviceState, MediaError } from '../types/media';

/** Which device a media request/error concerns. */
type MediaDeviceTarget = MediaError['device'];

/**
 * Translate a browser `DOMException` (or unknown throwable) into a user-facing
 * `MediaError`. The mapping is:
 *
 *   NotAllowedError       -> 'denied'          (permission refused)
 *   NotFoundError         -> 'notFound'        (no matching device)
 *   NotReadableError      -> 'inUse'           (hardware busy / in use)
 *   OverconstrainedError  -> 'overconstrained' (constraints unsatisfiable)
 *   anything else / none  -> 'unknown'
 *
 * The returned `message` always names the affected device and includes
 * remediation steps so the UI can surface actionable guidance.
 *
 * Requirements: 7.5, 7.6, 10.2, 10.3, 10.4.
 */
export function mapMediaError(
  exception: unknown,
  device: MediaDeviceTarget
): MediaError {
  const name =
    exception && typeof exception === 'object' && 'name' in exception
      ? String((exception as { name: unknown }).name)
      : '';

  const label = deviceLabel(device);

  let kind: MediaError['kind'];
  let detail: string;

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError': // legacy alias
      kind = 'denied';
      detail =
        `Access to your ${label} was blocked. ` +
        `Open your browser's site permissions (the icon in the address bar), ` +
        `set ${label} to "Allow", then reload the page and try again.`;
      break;
    case 'NotFoundError':
    case 'DevicesNotFoundError': // legacy alias
      kind = 'notFound';
      detail =
        `No ${label} could be found. ` +
        `Connect a ${label} to your computer, make sure it is not disabled ` +
        `in your system settings, then retry.`;
      break;
    case 'NotReadableError':
    case 'TrackStartError': // legacy alias
      kind = 'inUse';
      detail =
        `Your ${label} could not be started — it may be in use by another ` +
        `application. Close any other app using the ${label} ` +
        `(video conferencing, camera, or recording tools), then retry.`;
      break;
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError': // legacy alias
      kind = 'overconstrained';
      detail =
        `The selected ${label} does not support the requested settings. ` +
        `Choose a different ${label} from the device list, then retry.`;
      break;
    default:
      kind = 'unknown';
      detail =
        `Something went wrong while accessing your ${label}. ` +
        `Check that the device is connected and not disabled, then retry. ` +
        `Reloading the page may also help.`;
      break;
  }

  return { device, kind, message: detail };
}

/** Human-friendly wording for a device target used inside messages. */
function deviceLabel(device: MediaDeviceTarget): string {
  switch (device) {
    case 'camera':
      return 'camera';
    case 'microphone':
      return 'microphone';
    case 'screen':
      return 'screen';
    case 'both':
      return 'camera and microphone';
    default:
      return 'device';
  }
}

/** Public shape of the hook (Design section 8, `UseMediaDevices`). */
export interface UseMediaDevices {
  state: MediaDeviceState;
  /** getUserMedia with selected constraints; requested on mount within ~1s (Req 7.2). */
  requestPreview: () => Promise<void>;
  /** enumerateDevices to populate camera/microphone pickers (Req 7.8). */
  enumerate: () => Promise<void>;
  /** Select a specific camera and re-request the preview (Req 7.8, ≤2s). */
  selectCamera: (deviceId: string) => void;
  /** Select a specific microphone and re-request the preview (Req 7.8). */
  selectMic: (deviceId: string) => void;
  /** Toggle the local camera enabled flag (Req 7.4). */
  toggleCamera: () => void;
  /** Toggle the local microphone enabled flag (Req 7.4). */
  toggleMic: () => void;
  /** Re-request access after a failure (Req 7.6). */
  retry: () => Promise<void>;
  /** Stop preview tracks and clean up (called on unmount / handoff). */
  stop: () => void;
}

const INITIAL_STATE: MediaDeviceState = {
  status: 'idle',
  cameras: [],
  microphones: [],
  selectedCameraId: undefined,
  selectedMicId: undefined,
  cameraEnabled: true,
  micEnabled: true,
  previewStream: null,
  error: undefined,
};

/** Report a clear message when the Media Capture APIs are unavailable. */
function mediaDevicesUnavailable(): boolean {
  return (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  );
}

function unavailableError(device: MediaDeviceTarget): MediaError {
  return {
    device,
    kind: 'unknown',
    message:
      `Your browser did not expose the camera and microphone APIs. ` +
      `This usually happens on an insecure (non-HTTPS) connection. ` +
      `Open the app over HTTPS (or on localhost) using an up-to-date browser, ` +
      `then reload the page and try again.`,
  };
}

/**
 * `useMediaDevices` — see {@link UseMediaDevices}.
 *
 * On mount it requests camera + microphone within ~1s (Req 7.2). Toggles only
 * flip local enabled flags and mirror them onto live tracks so preview state
 * reflects intent before joining (Req 7.4). Errors are surfaced through the
 * mapped `MediaError` in state and never throw to the caller.
 */
export function useMediaDevices(): UseMediaDevices {
  const [state, setState] = useState<MediaDeviceState>(INITIAL_STATE);

  // Refs mirror the current stream + selections/flags so async callbacks and
  // the unmount cleanup can act on the latest values without stale closures.
  const streamRef = useRef<MediaStream | null>(null);
  const selectedCameraRef = useRef<string | undefined>(undefined);
  const selectedMicRef = useRef<string | undefined>(undefined);
  const cameraEnabledRef = useRef<boolean>(true);
  const micEnabledRef = useRef<boolean>(true);
  const mountedRef = useRef<boolean>(true);

  /** Stop every track on the current preview stream and drop the reference. */
  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stopStream();
    if (!mountedRef.current) return;
    setState((prev) => ({ ...prev, previewStream: null }));
  }, [stopStream]);

  /**
   * Core request: acquire a stream for the current selections/flags, mirror the
   * enabled flags onto its tracks, and store it. Any failure is mapped to a
   * `MediaError` and stored in state (no throw).
   */
  const requestPreview = useCallback(async () => {
    if (mediaDevicesUnavailable()) {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        status: 'error',
        previewStream: null,
        error: unavailableError('both'),
      }));
      return;
    }

    // Release any prior stream before requesting a new one.
    stopStream();

    if (mountedRef.current) {
      setState((prev) => ({ ...prev, status: 'requesting', error: undefined }));
    }

    const camId = selectedCameraRef.current;
    const micId = selectedMicRef.current;
    const constraints: MediaStreamConstraints = {
      video: camId ? { deviceId: { exact: camId } } : true,
      audio: micId ? { deviceId: { exact: micId } } : true,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // If the hook unmounted mid-request, discard the fresh stream.
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      // Mirror the local enabled flags onto the acquired tracks.
      stream.getVideoTracks().forEach((t) => {
        t.enabled = cameraEnabledRef.current;
      });
      stream.getAudioTracks().forEach((t) => {
        t.enabled = micEnabledRef.current;
      });

      streamRef.current = stream;
      setState((prev) => ({
        ...prev,
        status: 'granted',
        previewStream: stream,
        error: undefined,
      }));
    } catch (err) {
      if (!mountedRef.current) return;
      // Attribute the failure to the affected device(s). With both requested we
      // report 'both'; OverconstrainedError from a specific selection points at
      // that device.
      const device = errorDeviceContext(err, Boolean(camId), Boolean(micId));
      const mapped = mapMediaError(err, device);
      const status = mapped.kind === 'denied' ? 'denied' : 'error';
      streamRef.current = null;
      setState((prev) => ({
        ...prev,
        status,
        previewStream: null,
        error: mapped,
      }));
    }
  }, [stopStream]);

  const enumerate = useCallback(async () => {
    if (mediaDevicesUnavailable() || typeof navigator.mediaDevices.enumerateDevices !== 'function') {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        error: prev.error ?? unavailableError('both'),
      }));
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (!mountedRef.current) return;
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      const microphones = devices.filter((d) => d.kind === 'audioinput');
      setState((prev) => ({
        ...prev,
        cameras,
        microphones,
        // Default the selection to the first available device of each type when
        // none has been chosen yet.
        selectedCameraId: prev.selectedCameraId ?? cameras[0]?.deviceId,
        selectedMicId: prev.selectedMicId ?? microphones[0]?.deviceId,
      }));
      if (!selectedCameraRef.current && cameras[0]) {
        selectedCameraRef.current = cameras[0].deviceId;
      }
      if (!selectedMicRef.current && microphones[0]) {
        selectedMicRef.current = microphones[0].deviceId;
      }
    } catch {
      // Enumeration failures are non-fatal; leave the current lists intact.
    }
  }, []);

  const selectCamera = useCallback(
    (deviceId: string) => {
      selectedCameraRef.current = deviceId;
      setState((prev) => ({ ...prev, selectedCameraId: deviceId }));
      void requestPreview();
    },
    [requestPreview]
  );

  const selectMic = useCallback(
    (deviceId: string) => {
      selectedMicRef.current = deviceId;
      setState((prev) => ({ ...prev, selectedMicId: deviceId }));
      void requestPreview();
    },
    [requestPreview]
  );

  const toggleCamera = useCallback(() => {
    const next = !cameraEnabledRef.current;
    cameraEnabledRef.current = next;
    streamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setState((prev) => ({ ...prev, cameraEnabled: next }));
  }, []);

  const toggleMic = useCallback(() => {
    const next = !micEnabledRef.current;
    micEnabledRef.current = next;
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setState((prev) => ({ ...prev, micEnabled: next }));
  }, []);

  const retry = useCallback(async () => {
    await requestPreview();
  }, [requestPreview]);

  // On mount: request the preview within ~1s (Req 7.2) and enumerate devices so
  // pickers can populate. On unmount: stop tracks (cleanup).
  useEffect(() => {
    mountedRef.current = true;
    void requestPreview();
    void enumerate();
    return () => {
      mountedRef.current = false;
      stopStream();
    };
    // requestPreview/enumerate/stopStream are stable (useCallback); run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    requestPreview,
    enumerate,
    selectCamera,
    selectMic,
    toggleCamera,
    toggleMic,
    retry,
    stop,
  };
}

/**
 * Decide which device a getUserMedia failure concerns. When both audio+video
 * were requested we report 'both'; a device-specific constraint failure points
 * at the constrained device.
 */
function errorDeviceContext(
  exception: unknown,
  hasCameraSelection: boolean,
  hasMicSelection: boolean
): MediaDeviceTarget {
  const name =
    exception && typeof exception === 'object' && 'name' in exception
      ? String((exception as { name: unknown }).name)
      : '';

  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    if (hasCameraSelection && !hasMicSelection) return 'camera';
    if (hasMicSelection && !hasCameraSelection) return 'microphone';
  }
  return 'both';
}

export default useMediaDevices;
