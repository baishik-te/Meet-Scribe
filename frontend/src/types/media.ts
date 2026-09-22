// Media and call-toolbar types used by the media-permission hook and CallRoom.

// State owned by the `useMediaDevices` hook.
export interface MediaDeviceState {
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'error';
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  selectedCameraId?: string;
  selectedMicId?: string;
  cameraEnabled: boolean;
  micEnabled: boolean;
  previewStream: MediaStream | null;
  error?: MediaError; 
}

// User-facing media error, mapped from a browser DOMException.
export interface MediaError {
  device: 'camera' | 'microphone' | 'screen' | 'both';
  kind: 'denied' | 'notFound' | 'inUse' | 'overconstrained' | 'unknown';
  message: string; 
}

// Local + remote toggle state for the Call_Toolbar. 
export interface CallToolbarState {
  cameraEnabled: boolean;
  micEnabled: boolean;
  screenSharing: boolean;
  recording: boolean;
  transcribing: boolean;
  chatOpen: boolean;
  handRaised: boolean; 
  reaction?: string; 
  peopleOpen: boolean; 
  viewMode: 'gallery' | 'speaker'; 
}
