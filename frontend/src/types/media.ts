// Media and call-toolbar types used by the media-permission hook and CallRoom.

/** State owned by the `useMediaDevices` hook. */
export interface MediaDeviceState {
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'error';
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  selectedCameraId?: string;
  selectedMicId?: string;
  cameraEnabled: boolean;
  micEnabled: boolean;
  previewStream: MediaStream | null;
  error?: MediaError; // mapped from DOMException
}

/** User-facing media error, mapped from a browser DOMException. */
export interface MediaError {
  device: 'camera' | 'microphone' | 'screen' | 'both';
  kind: 'denied' | 'notFound' | 'inUse' | 'overconstrained' | 'unknown';
  message: string; // user-facing, includes remediation steps
}

/** Local + remote toggle state for the Call_Toolbar. */
export interface CallToolbarState {
  cameraEnabled: boolean;
  micEnabled: boolean;
  screenSharing: boolean;
  recording: boolean;
  transcribing: boolean;
  chatOpen: boolean;
  handRaised: boolean; // local-only
  reaction?: string; // local-only
  peopleOpen: boolean; // local-only
  viewMode: 'gallery' | 'speaker'; // local-only
}
