/**
 * Camera facing helpers shared by the pre-join screen, the media hook and the
 * in-call toolbar.
 *
 * Background: on phones/tablets the browser exposes several `videoinput`
 * devices whose order is decided by the OS, so "Camera 1" in a raw device list
 * is not reliably the back camera. We normalise that here:
 *
 *   index 0 -> back / environment camera
 *   index 1 -> front / selfie camera
 *   index 2+ -> any remaining lenses, original order preserved
 *
 * The reordering is applied to mobile and tablet devices only; on desktop the
 * OS order is meaningful and is left untouched.
 */

export type CameraFacing = 'user' | 'environment';

/**
 * Milliseconds to wait after stopping a video track before asking for another
 * camera. Android/iOS keep the hardware lock for a short moment after
 * `track.stop()`; requesting too early yields NotReadableError / TrackStartError
 * ("in use by another application").
 */
export const HARDWARE_RELEASE_MS = 400;

// Matches Android ("camera2 0, facing back"), iOS ("Back Camera",
// "Back Dual Wide Camera") and generic ("USB Rear Cam") labels.
const BACK_FACING = /(^|[^a-z])(back|rear)([^a-z]|$)|environment/i;
const FRONT_FACING = /(^|[^a-z])(front|selfie)([^a-z]|$)|facing user|user facing/i;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve after the browser has had a chance to commit pending DOM work, so a
 * `<video>` element that was detached from a stream actually releases it before
 * we ask the OS for the camera again.
 */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      setTimeout(resolve, 0);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** True for phones and tablets, including iPadOS which reports a Mac UA. */
export function isMobileOrTablet(): boolean {
  if (typeof navigator === 'undefined') return false;

  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData && uaData.mobile === true) return true;

  const ua = navigator.userAgent || '';
  if (
    /Android|iPhone|iPod|iPad|Windows Phone|IEMobile|Opera Mini|BlackBerry|BB10|Kindle|Silk|PlayBook|Mobile|Tablet/i.test(
      ua
    )
  ) {
    return true;
  }

  // iPadOS 13+ in desktop mode: "Macintosh" UA plus a touch screen.
  const touchPoints = typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0;
  if (/Macintosh/i.test(ua) && touchPoints > 1) return true;

  return false;
}

/** Infer which way a camera points from its human readable label. */
export function cameraFacingFromLabel(label?: string | null): CameraFacing | undefined {
  if (!label) return undefined;
  if (BACK_FACING.test(label)) return 'environment';
  if (FRONT_FACING.test(label)) return 'user';
  return undefined;
}

export function cameraFacing(device?: MediaDeviceInfo | null): CameraFacing | undefined {
  return cameraFacingFromLabel(device?.label);
}

/** First camera in `cameras` pointing the requested way, if any. */
export function findCameraByFacing(
  cameras: MediaDeviceInfo[],
  facing: CameraFacing
): MediaDeviceInfo | undefined {
  return cameras.find((cam) => cameraFacing(cam) === facing);
}

/**
 * On mobile/tablet, return the camera list with the back camera first and the
 * front camera second. Returns the input untouched when the device is not a
 * phone/tablet, when there is only one camera, or when labels are still empty
 * (labels are hidden until camera permission has been granted).
 */
export function orderCamerasByFacing(cameras: MediaDeviceInfo[]): MediaDeviceInfo[] {
  if (cameras.length < 2 || !isMobileOrTablet()) return cameras;

  const back = findCameraByFacing(cameras, 'environment');
  const front = findCameraByFacing(cameras, 'user');
  if (!back || !front) return cameras;

  const rest = cameras.filter(
    (cam) => cam.deviceId !== back.deviceId && cam.deviceId !== front.deviceId
  );
  return [back, front, ...rest];
}

/**
 * Display name for a camera picker entry. On mobile/tablet the raw OS labels
 * ("camera2 0, facing back") are replaced with plain wording so the mapping
 * between the list position and the physical lens is obvious.
 */
export function cameraDisplayLabel(
  camera: MediaDeviceInfo,
  index: number,
  cameras: MediaDeviceInfo[] = []
): string {
  if (isMobileOrTablet()) {
    const facing = cameraFacing(camera);
    if (facing) {
      const sameFacing = cameras.filter((cam) => cameraFacing(cam) === facing);
      const base = facing === 'environment' ? 'Back camera' : 'Front camera (selfie)';
      if (sameFacing.length < 2) return base;
      const position = sameFacing.findIndex((cam) => cam.deviceId === camera.deviceId);
      return `${base} ${position + 1}`;
    }
  }
  return camera.label || `Camera ${index + 1}`;
}

/** Live, facing-ordered camera list. Empty when enumeration is unavailable. */
export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.enumerateDevices !== 'function'
  ) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return orderCamerasByFacing(devices.filter((d) => d.kind === 'videoinput'));
  } catch {
    return [];
  }
}

/** deviceId of a camera pointing the requested way, when one can be identified. */
export async function findDeviceIdForFacing(facing: CameraFacing): Promise<string | undefined> {
  const cameras = await listCameras();
  return findCameraByFacing(cameras, facing)?.deviceId;
}

/** Which way a known deviceId points, resolved from the live device list. */
export async function findFacingForDeviceId(
  deviceId?: string
): Promise<CameraFacing | undefined> {
  if (!deviceId) return undefined;
  const cameras = await listCameras();
  return cameraFacing(cameras.find((cam) => cam.deviceId === deviceId));
}

/**
 * deviceId to open when flipping the camera.
 *
 * Labels are the reliable signal, but some browsers return empty labels even
 * after permission is granted. On a two-camera phone "the other camera" is then
 * an equally good answer, so that is the second choice.
 */
export async function findFlipTargetDeviceId(
  currentDeviceId: string | undefined,
  targetFacing: CameraFacing
): Promise<string | undefined> {
  const cameras = await listCameras();
  if (!cameras.length) return undefined;

  const labelled = findCameraByFacing(cameras, targetFacing);
  if (labelled && labelled.deviceId !== currentDeviceId) return labelled.deviceId;

  const other = cameras.find((cam) => cam.deviceId && cam.deviceId !== currentDeviceId);
  if (other) return other.deviceId;

  return labelled?.deviceId;
}
