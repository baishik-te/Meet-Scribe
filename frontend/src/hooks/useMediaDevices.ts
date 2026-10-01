import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaDeviceState, MediaError } from '../types/media';
import {
  HARDWARE_RELEASE_MS,
  cameraFacing,
  cameraFacingFromLabel,
  delay,
  findCameraByFacing,
  nextFrame,
  orderCamerasByFacing,
  type CameraFacing,
} from '../lib/cameraFacing';

type MediaDeviceTarget = MediaError['device'];

export function mapMediaError(
  exception: unknown,
  device: MediaDeviceTarget
): MediaError {
  const name = errorName(exception);

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

function errorName(exception: unknown): string {
  return exception && typeof exception === 'object' && 'name' in exception
    ? String((exception as { name: unknown }).name)
    : '';
}

/** Permission failures can never be recovered by loosening constraints. */
function isPermissionError(exception: unknown): boolean {
  const name = errorName(exception);
  return (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    name === 'SecurityError'
  );
}

/** The device exists but the OS still holds the hardware lock. */
function isDeviceBusyError(exception: unknown): boolean {
  const name = errorName(exception);
  return name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError';
}

// Public shape of the hook
export interface UseMediaDevices {
  state: MediaDeviceState;

  requestPreview: () => Promise<void>;

  enumerate: () => Promise<void>;

  selectCamera: (deviceId: string) => void;

  selectMic: (deviceId: string) => void;

  toggleCamera: () => void;

  toggleMic: () => void;

  retry: () => Promise<void>;

  stop: () => void;
}

const INITIAL_STATE: MediaDeviceState = {
  status: 'idle',
  cameras: [],
  microphones: [],
  selectedCameraId: undefined,
  selectedMicId: undefined,
  activeFacingMode: undefined,
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

/** What a single acquisition pass needs to (re-)open. */
type AcquireTarget = 'all' | 'video' | 'audio';

export function useMediaDevices(): UseMediaDevices {
  const [state, setState] = useState<MediaDeviceState>(INITIAL_STATE);

  // Tracks are owned individually so a camera switch never touches the
  // microphone (and therefore cannot trigger a second permission prompt or a
  // mic-level hardware re-lock).
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const previewRef = useRef<MediaStream | null>(null);

  const camerasRef = useRef<MediaDeviceInfo[]>([]);
  const microphonesRef = useRef<MediaDeviceInfo[]>([]);
  const selectedCameraRef = useRef<string | undefined>(undefined);
  const selectedMicRef = useRef<string | undefined>(undefined);
  const cameraEnabledRef = useRef<boolean>(true);
  const micEnabledRef = useRef<boolean>(true);
  const mountedRef = useRef<boolean>(true);

  // Monotonic counter: only the newest acquisition is allowed to publish state.
  const generationRef = useRef<number>(0);
  // Serialises acquisitions so two getUserMedia calls can never overlap — an
  // overlap is what produces "in use by another application" when flipping.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const stopTrack = useCallback((track: MediaStreamTrack | null) => {
    if (!track) return;
    const stream = previewRef.current;
    if (stream && typeof stream.removeTrack === 'function') {
      try {
        stream.removeTrack(track);
      } catch {}
    }
    try {
      track.stop();
    } catch {}
  }, []);

  const stopVideoTrack = useCallback(() => {
    const track = videoTrackRef.current;
    videoTrackRef.current = null;
    stopTrack(track);
  }, [stopTrack]);

  const stopAudioTrack = useCallback(() => {
    const track = audioTrackRef.current;
    audioTrackRef.current = null;
    stopTrack(track);
  }, [stopTrack]);

  const stopStream = useCallback(() => {
    stopVideoTrack();
    stopAudioTrack();
    previewRef.current = null;
  }, [stopAudioTrack, stopVideoTrack]);

  const stop = useCallback(() => {
    generationRef.current += 1;
    stopStream();
    if (!mountedRef.current) return;
    setState((prev) => ({ ...prev, previewStream: null }));
  }, [stopStream]);

  /** Rebuild the preview stream from whichever tracks are currently live. */
  const composePreview = useCallback((): MediaStream | null => {
    const tracks: MediaStreamTrack[] = [];
    if (videoTrackRef.current) {
      videoTrackRef.current.enabled = cameraEnabledRef.current;
      tracks.push(videoTrackRef.current);
    }
    if (audioTrackRef.current) {
      audioTrackRef.current.enabled = micEnabledRef.current;
      tracks.push(audioTrackRef.current);
    }
    if (!tracks.length) {
      previewRef.current = null;
      return null;
    }
    try {
      const composed = new MediaStream(tracks);
      previewRef.current = composed;
      return composed;
    } catch {
      return previewRef.current;
    }
  }, []);

  const readDevices = useCallback(async () => {
    if (
      mediaDevicesUnavailable() ||
      typeof navigator.mediaDevices.enumerateDevices !== 'function'
    ) {
      return { cameras: camerasRef.current, microphones: microphonesRef.current };
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      // Back camera first, front camera second — mobile/tablet only.
      const cameras = orderCamerasByFacing(devices.filter((d) => d.kind === 'videoinput'));
      const microphones = devices.filter((d) => d.kind === 'audioinput');
      camerasRef.current = cameras;
      microphonesRef.current = microphones;
      return { cameras, microphones };
    } catch {
      return { cameras: camerasRef.current, microphones: microphonesRef.current };
    }
  }, []);

  const enumerate = useCallback(async () => {
    if (
      mediaDevicesUnavailable() ||
      typeof navigator.mediaDevices.enumerateDevices !== 'function'
    ) {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        error: prev.error ?? unavailableError('both'),
      }));
      return;
    }

    const { cameras, microphones } = await readDevices();
    if (!mountedRef.current) return;

    setState((prev) => {
      const nextCamId = prev.selectedCameraId ?? cameras[0]?.deviceId;
      const nextMicId = prev.selectedMicId ?? microphones[0]?.deviceId;
      if (!selectedCameraRef.current && nextCamId) {
        selectedCameraRef.current = nextCamId;
      }
      if (!selectedMicRef.current && nextMicId) {
        selectedMicRef.current = nextMicId;
      }
      return {
        ...prev,
        cameras,
        microphones,
        selectedCameraId: nextCamId,
        selectedMicId: nextMicId,
      };
    });
  }, [readDevices]);

  /**
   * Candidate video constraints, strictest first.
   *
   * `deviceId: { exact }` is the only constraint a browser is obliged to honour.
   * The previous implementation used `{ ideal: ... }`, which Chrome on Android
   * is free to ignore — that is why picking "camera 0, facing back" kept
   * opening the front sensor. `facingMode: { exact }` is the next best thing,
   * and a bare `true` is the final "at least show something" fallback.
   */
  const videoCandidates = useCallback(
    (deviceId: string | undefined, facing: CameraFacing | undefined) => {
      const candidates: Array<MediaTrackConstraints | boolean> = [];
      if (deviceId) candidates.push({ deviceId: { exact: deviceId } });
      if (facing) {
        candidates.push({ facingMode: { exact: facing } });
        candidates.push({ facingMode: facing });
      }
      candidates.push(true);
      return candidates;
    },
    []
  );

  const audioConstraint = useCallback((deviceId: string | undefined) => {
    return deviceId ? { deviceId: { ideal: deviceId } } : true;
  }, []);

  /**
   * Walk the candidate list until one opens. A busy device gets one extra
   * attempt after a hardware-release pause before we loosen the constraints.
   */
  const openWithFallback = useCallback(
    async (
      candidates: Array<MediaTrackConstraints | boolean>,
      audio: MediaTrackConstraints | boolean
    ): Promise<MediaStream> => {
      let lastError: unknown;
      for (const video of candidates) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            return await navigator.mediaDevices.getUserMedia({ video, audio });
          } catch (err) {
            lastError = err;
            if (isPermissionError(err)) throw err;
            if (isDeviceBusyError(err) && attempt === 0) {
              await delay(HARDWARE_RELEASE_MS);
              continue;
            }
            break;
          }
        }
      }
      throw lastError;
    },
    []
  );

  /** Work out which physical camera actually opened. */
  const resolveActiveCamera = useCallback(
    (cameras: MediaDeviceInfo[], track: MediaStreamTrack | null) => {
      const settings =
        track && typeof track.getSettings === 'function' ? track.getSettings() : undefined;
      const settingsDeviceId = settings?.deviceId;
      const settingsFacing = settings?.facingMode as CameraFacing | undefined;

      let match = settingsDeviceId
        ? cameras.find((cam) => cam.deviceId === settingsDeviceId)
        : undefined;

      if (!match) {
        // Safari omits deviceId from track settings; fall back to the label.
        if (track?.label) {
          match = cameras.find((cam) => cam.label && cam.label === track.label);
        }
        const labelFacing = settingsFacing ?? cameraFacingFromLabel(track?.label);
        if (!match && labelFacing) {
          match = findCameraByFacing(cameras, labelFacing);
        }
      }

      const facing =
        settingsFacing ?? cameraFacing(match) ?? cameraFacingFromLabel(track?.label);

      return {
        deviceId: match?.deviceId ?? settingsDeviceId ?? selectedCameraRef.current,
        facing,
      };
    },
    []
  );

  /**
   * Single acquisition pass.
   *
   * Order matters: stop the old track, drop the preview from React state so the
   * `<video>` element releases its reference, wait a frame plus a short pause so
   * the mobile OS actually gives up the hardware lock, and only then ask for the
   * new camera.
   */
  const acquire = useCallback(
    async (target: AcquireTarget) => {
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

      const generation = (generationRef.current += 1);
      const isCurrent = () => mountedRef.current && generationRef.current === generation;

      const needVideo = target === 'all' || target === 'video';
      const needAudio = target === 'all' || target === 'audio';

      const hadVideo = Boolean(videoTrackRef.current);
      const hadAudio = Boolean(audioTrackRef.current);

      // 1. Release the hardware we are about to re-open.
      if (needVideo) stopVideoTrack();
      if (needAudio) stopAudioTrack();
      previewRef.current = null;

      // 2. Detach the preview so no DOM node keeps the stopped track alive.
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          status: 'requesting',
          previewStream: null,
          error: undefined,
        }));
      }

      // 3. Give the browser a frame to commit, then let the OS drop the lock.
      await nextFrame();
      if ((needVideo && hadVideo) || (needAudio && hadAudio)) {
        await delay(HARDWARE_RELEASE_MS);
      }
      if (!isCurrent()) return;

      const camId = needVideo ? selectedCameraRef.current : undefined;
      const micId = selectedMicRef.current;

      // Facing of the requested camera, from the (possibly reordered) list.
      const requestedCam = camId
        ? camerasRef.current.find((cam) => cam.deviceId === camId)
        : undefined;
      const requestedFacing = cameraFacing(requestedCam);

      const videoRequest = needVideo ? videoCandidates(camId, requestedFacing) : [];
      const audioRequest = needAudio ? audioConstraint(micId) : false;

      try {
        let stream: MediaStream;
        if (needVideo) {
          stream = await openWithFallback(videoRequest, audioRequest);
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: audioRequest,
          });
        }

        if (!isCurrent()) {
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {}
          });
          return;
        }

        const nextVideo = stream.getVideoTracks()[0] ?? null;
        const nextAudio = stream.getAudioTracks()[0] ?? null;

        if (nextVideo) {
          stopVideoTrack();
          videoTrackRef.current = nextVideo;
        }
        if (nextAudio) {
          stopAudioTrack();
          audioTrackRef.current = nextAudio;
        }

        const preview = composePreview();

        // Labels are only populated once permission has been granted, so the
        // back/front ordering is recomputed here.
        const { cameras, microphones } = await readDevices();
        if (!isCurrent()) return;

        const active = resolveActiveCamera(cameras, videoTrackRef.current);
        if (active.deviceId) {
          selectedCameraRef.current = active.deviceId;
        }
        const activeMicId =
          (audioTrackRef.current && typeof audioTrackRef.current.getSettings === 'function'
            ? audioTrackRef.current.getSettings().deviceId
            : undefined) ?? selectedMicRef.current;
        if (activeMicId) {
          selectedMicRef.current = activeMicId;
        }

        setState((prev) => ({
          ...prev,
          status: 'granted',
          previewStream: preview,
          error: undefined,
          cameras,
          microphones,
          selectedCameraId: active.deviceId ?? prev.selectedCameraId,
          selectedMicId: activeMicId ?? prev.selectedMicId,
          activeFacingMode: active.facing,
        }));
      } catch (err) {
        if (!isCurrent()) return;

        // A camera-only failure must not kill a working microphone.
        const device: MediaDeviceTarget =
          target === 'video' ? 'camera' : target === 'audio' ? 'microphone' : 'both';
        const mapped = mapMediaError(err, device);
        const preview = composePreview();

        setState((prev) => ({
          ...prev,
          status: mapped.kind === 'denied' ? 'denied' : 'error',
          previewStream: preview,
          activeFacingMode: videoTrackRef.current ? prev.activeFacingMode : undefined,
          error: mapped,
        }));
      }
    },
    [
      audioConstraint,
      composePreview,
      openWithFallback,
      readDevices,
      resolveActiveCamera,
      stopAudioTrack,
      stopVideoTrack,
      videoCandidates,
    ]
  );

  /** Queue an acquisition so passes never overlap. */
  const enqueue = useCallback(
    (target: AcquireTarget): Promise<void> => {
      const run = queueRef.current.then(
        () => acquire(target),
        () => acquire(target)
      );
      queueRef.current = run.catch(() => undefined);
      return run;
    },
    [acquire]
  );

  const requestPreview = useCallback(() => enqueue('all'), [enqueue]);

  const selectCamera = useCallback(
    (deviceId: string) => {
      const sameDevice = selectedCameraRef.current === deviceId;
      const live = Boolean(videoTrackRef.current);
      if (sameDevice && live) return;
      selectedCameraRef.current = deviceId;
      setState((prev) => ({ ...prev, selectedCameraId: deviceId }));
      // Only the camera is re-opened; the microphone track keeps running.
      void enqueue('video');
    },
    [enqueue]
  );

  const selectMic = useCallback(
    (deviceId: string) => {
      const sameDevice = selectedMicRef.current === deviceId;
      const live = Boolean(audioTrackRef.current);
      if (sameDevice && live) return;
      selectedMicRef.current = deviceId;
      setState((prev) => ({ ...prev, selectedMicId: deviceId }));
      void enqueue('audio');
    },
    [enqueue]
  );

  const toggleCamera = useCallback(() => {
    const next = !cameraEnabledRef.current;
    cameraEnabledRef.current = next;
    if (videoTrackRef.current) {
      videoTrackRef.current.enabled = next;
    }
    setState((prev) => ({ ...prev, cameraEnabled: next }));
  }, []);

  const toggleMic = useCallback(() => {
    const next = !micEnabledRef.current;
    micEnabledRef.current = next;
    if (audioTrackRef.current) {
      audioTrackRef.current.enabled = next;
    }
    setState((prev) => ({ ...prev, micEnabled: next }));
  }, []);

  const retry = useCallback(() => enqueue('all'), [enqueue]);

  useEffect(() => {
    mountedRef.current = true;
    void enqueue('all');
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      stopStream();
    };
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

export default useMediaDevices;
