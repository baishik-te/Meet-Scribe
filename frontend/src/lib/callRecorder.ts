import { Room, RoomEvent, Track } from 'livekit-client';
import type { TrackPublication, Participant } from 'livekit-client';

/**
 * CallRecorder produces a single WebM recording of the whole meeting entirely in
 * the browser:
 *   - Video: every participant's camera (and any screen share) is drawn onto a
 *     canvas in a grid each frame; the canvas is captured as the video track.
 *   - Audio: every microphone track (local + remote) is mixed through a Web
 *     Audio graph into one output track.
 * The two are combined into one MediaStream and fed to a MediaRecorder. On stop
 * it returns the recorded Blob plus the elapsed duration for upload.
 */
export class CallRecorder {
  private room: Room;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private videoEls = new Map<string, HTMLVideoElement>(); // trackSid -> element
  private audioCtx: AudioContext | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private audioSources = new Map<string, MediaStreamAudioSourceNode>();
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private rafId = 0;
  private startTime = 0;
  private running = false;
  private mimeType = 'video/webm';

  constructor(room: Room) {
    this.room = room;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1280;
    this.canvas.height = 720;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
  }

  static isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    const AudioCtx: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioCtx();
    this.dest = this.audioCtx.createMediaStreamDestination();

    // Seed current tracks, then keep them in sync as people join/leave/toggle.
    this.collectAllTracks();
    this.room.on(RoomEvent.TrackSubscribed, this.handleTrackChange);
    this.room.on(RoomEvent.TrackUnsubscribed, this.handleTrackChange);
    this.room.on(RoomEvent.LocalTrackPublished, this.handleTrackChange);
    this.room.on(RoomEvent.LocalTrackUnpublished, this.handleTrackChange);
    this.room.on(RoomEvent.TrackMuted, this.handleTrackChange);
    this.room.on(RoomEvent.TrackUnmuted, this.handleTrackChange);

    this.renderLoop();

    const videoStream = this.canvas.captureStream(30);
    const combined = new MediaStream();
    videoStream.getVideoTracks().forEach((t) => combined.addTrack(t));
    this.dest.stream.getAudioTracks().forEach((t) => combined.addTrack(t));

    this.mimeType = pickMimeType();
    this.recorder = new MediaRecorder(combined, { mimeType: this.mimeType });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(1000); // gather data every second
    this.startTime = Date.now();
  }

  async stop(): Promise<{ blob: Blob; durationSeconds: number; mimeType: string }> {
    const durationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));

    this.room.off(RoomEvent.TrackSubscribed, this.handleTrackChange);
    this.room.off(RoomEvent.TrackUnsubscribed, this.handleTrackChange);
    this.room.off(RoomEvent.LocalTrackPublished, this.handleTrackChange);
    this.room.off(RoomEvent.LocalTrackUnpublished, this.handleTrackChange);
    this.room.off(RoomEvent.TrackMuted, this.handleTrackChange);
    this.room.off(RoomEvent.TrackUnmuted, this.handleTrackChange);

    cancelAnimationFrame(this.rafId);
    this.running = false;

    const blob = await new Promise<Blob>((resolve) => {
      if (!this.recorder || this.recorder.state === 'inactive') {
        resolve(new Blob(this.chunks, { type: this.mimeType }));
        return;
      }
      this.recorder.onstop = () => resolve(new Blob(this.chunks, { type: this.mimeType }));
      this.recorder.stop();
    });

    // Teardown audio graph + offscreen video elements.
    this.audioSources.forEach((s) => s.disconnect());
    this.audioSources.clear();
    this.videoEls.forEach((v) => {
      v.srcObject = null;
    });
    this.videoEls.clear();
    try {
      await this.audioCtx?.close();
    } catch {
      /* ignore */
    }
    this.audioCtx = null;
    this.dest = null;

    return { blob, durationSeconds, mimeType: this.mimeType };
  }

  private handleTrackChange = () => {
    this.collectAllTracks();
  };

  private collectAllTracks(): void {
    const participants: Participant[] = [this.room.localParticipant, ...this.room.remoteParticipants.values()];
    const liveVideoSids = new Set<string>();
    const liveAudioSids = new Set<string>();

    for (const participant of participants) {
      const isLocal = participant === this.room.localParticipant;
      participant.trackPublications.forEach((pub: TrackPublication) => {
        const track = pub.track;
        if (!track || !track.mediaStreamTrack) return;

        if (pub.kind === Track.Kind.Video) {
          if (pub.isMuted) return;
          liveVideoSids.add(pub.trackSid);
          if (!this.videoEls.has(pub.trackSid)) {
            const el = document.createElement('video');
            el.muted = true;
            el.autoplay = true;
            el.playsInline = true;
            el.srcObject = new MediaStream([track.mediaStreamTrack]);
            el.play().catch(() => {});
            this.videoEls.set(pub.trackSid, el);
          }
        } else if (pub.kind === Track.Kind.Audio && !isLocal) {
          // Remote mic audio. (Local mic is added explicitly below so muted
          // remote-publication state doesn't drop the local voice.)
          liveAudioSids.add(pub.trackSid);
          this.addAudioSource(pub.trackSid, track.mediaStreamTrack);
        }
      });
    }

    // Always include the local microphone so the recording has our own voice.
    const localMic = this.room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (localMic?.track?.mediaStreamTrack) {
      liveAudioSids.add(localMic.trackSid);
      this.addAudioSource(localMic.trackSid, localMic.track.mediaStreamTrack);
    }

    // Drop video elements whose tracks disappeared.
    for (const sid of Array.from(this.videoEls.keys())) {
      if (!liveVideoSids.has(sid)) {
        const el = this.videoEls.get(sid);
        if (el) el.srcObject = null;
        this.videoEls.delete(sid);
      }
    }
    // Disconnect audio sources whose tracks disappeared.
    for (const sid of Array.from(this.audioSources.keys())) {
      if (!liveAudioSids.has(sid)) {
        this.audioSources.get(sid)?.disconnect();
        this.audioSources.delete(sid);
      }
    }
  }

  private addAudioSource(sid: string, mediaStreamTrack: MediaStreamTrack): void {
    if (!this.audioCtx || !this.dest || this.audioSources.has(sid)) return;
    const src = this.audioCtx.createMediaStreamSource(new MediaStream([mediaStreamTrack]));
    src.connect(this.dest);
    this.audioSources.set(sid, src);
  }

  private renderLoop = () => {
    if (!this.running) return;
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    ctx.fillStyle = '#0f121a';
    ctx.fillRect(0, 0, width, height);

    const els = Array.from(this.videoEls.values()).filter((v) => v.videoWidth > 0);
    const n = els.length;

    if (n === 0) {
      ctx.fillStyle = '#8a93a6';
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Recording…', width / 2, height / 2);
    } else {
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const cellW = width / cols;
      const cellH = height / rows;
      els.forEach((el, i) => {
        const cx = (i % cols) * cellW;
        const cy = Math.floor(i / cols) * cellH;
        drawCover(ctx, el, cx, cy, cellW, cellH);
      });
    }

    this.rafId = requestAnimationFrame(this.renderLoop);
  };
}

/** Draw a video element covering the target rect while preserving aspect ratio. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(video, dx, dy, dw, dh);
}

function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'video/webm';
}
