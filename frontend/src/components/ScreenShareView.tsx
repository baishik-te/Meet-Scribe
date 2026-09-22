import React, { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

interface ScreenShareViewProps {
  room: Room;
  onActiveChange?: (active: boolean) => void;
}


export const ScreenShareView: React.FC<ScreenShareViewProps> = ({ room, onActiveChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const findShareTrack = (): Track | null => {
      const participants = [room.localParticipant, ...room.remoteParticipants.values()];
      for (const participant of participants) {
        for (const pub of participant.trackPublications.values()) {
          if (
            pub.source === Track.Source.ScreenShare &&
            pub.kind === Track.Kind.Video &&
            pub.track
          ) {
            return pub.track;
          }
        }
      }
      return null;
    };

    const sync = () => {
      const track = findShareTrack();
      const el = videoRef.current;
      if (track && el) {
        track.attach(el);
        setActive((prev) => {
          if (!prev) onActiveChange?.(true);
          return true;
        });
      } else {
        setActive((prev) => {
          if (prev) onActiveChange?.(false);
          return false;
        });
      }
    };

    sync();

    const events: RoomEvent[] = [
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
    ];
    events.forEach((e) => room.on(e, sync));

    return () => {
      events.forEach((e) => room.off(e, sync));
    };
  }, [room, onActiveChange]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: active ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          background: 'rgba(0,0,0,0.6)',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 12,
        }}
      >
        🖥 Screen share
      </div>
    </div>
  );
};

export default ScreenShareView;
