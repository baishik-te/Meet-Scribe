import React, { useEffect, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import type { Participant } from 'livekit-client';

interface ParticipantTileProps {
  
  participant: Participant;
  
  displayName: string;
  
  muteAudio?: boolean;
  
  badgeSuffix?: string;
}


export const ParticipantTile: React.FC<ParticipantTileProps> = ({
  participant,
  displayName,
  muteAudio = false,
  badgeSuffix,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micMuted, setMicMuted] = useState(true);

  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;

    const sync = () => {
      let videoAttached = false;
      let audioMuted = true;

      participant.trackPublications.forEach((pub) => {
        const track = pub.track;
        if (!track) return;

        if (pub.kind === Track.Kind.Video) {
          // Only show the camera source in the tile (ignore screen share here).
          if (pub.source === Track.Source.Camera && videoEl) {
            track.attach(videoEl);
            videoAttached = pub.isSubscribed && !pub.isMuted;
          }
        } else if (pub.kind === Track.Kind.Audio) {
          if (pub.source === Track.Source.Microphone) {
            audioMuted = pub.isMuted;
            // Never attach the local participant's own mic (avoids echo).
            if (!muteAudio && audioEl) {
              track.attach(audioEl);
            }
          }
        }
      });

      setHasVideo(videoAttached);
      setMicMuted(audioMuted);
    };

    sync();

    const handleSpeaking = (speaking: boolean) => setIsSpeaking(speaking);

    participant.on('trackSubscribed', sync);
    participant.on('trackUnsubscribed', sync);
    participant.on('trackMuted', sync);
    participant.on('trackUnmuted', sync);
    participant.on('trackPublished', sync);
    participant.on('trackUnpublished', sync);
    participant.on('localTrackPublished', sync);
    participant.on('localTrackUnpublished', sync);
    participant.on('isSpeakingChanged', handleSpeaking);

    return () => {
      participant.off('trackSubscribed', sync);
      participant.off('trackUnsubscribed', sync);
      participant.off('trackMuted', sync);
      participant.off('trackUnmuted', sync);
      participant.off('trackPublished', sync);
      participant.off('trackUnpublished', sync);
      participant.off('localTrackPublished', sync);
      participant.off('localTrackUnpublished', sync);
      participant.off('isSpeakingChanged', handleSpeaking);

      // Detach any tracks from this tile's elements on unmount.
      participant.trackPublications.forEach((pub) => {
        if (pub.track) {
          if (videoEl) pub.track.detach(videoEl);
          if (audioEl) pub.track.detach(audioEl);
        }
      });
    };
  }, [participant, muteAudio]);

  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--bg-card-secondary, #1a1d27)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        aspectRatio: '16 / 9',
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: isSpeaking ? '2px solid var(--accent-blue)' : '2px solid transparent',
        transition: 'border-color 120ms ease',
      }}
    >
      {/* Camera feed. Kept mounted so tracks can attach; hidden behind the
          avatar when there is no active video. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muteAudio}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: hasVideo ? 'block' : 'none',
        }}
      />

      {/* Standalone audio sink for the participant's microphone (remote only). */}
      {!muteAudio && <audio ref={audioRef} autoPlay />}

      {/* Avatar placeholder shown when the camera is off. */}
      {!hasVideo && (
        <div
          aria-hidden="true"
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'var(--accent-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 600,
            color: '#fff',
          }}
        >
          {initials || '👤'}
        </div>
      )}

      {/* Name badge + mic status. */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          background: 'rgba(0,0,0,0.6)',
          padding: '3px 8px',
          borderRadius: 6,
          maxWidth: 'calc(100% - 16px)',
        }}
      >
        <span aria-hidden="true">{micMuted ? '🔇' : '🎤'}</span>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displayName}
          {badgeSuffix ? ` ${badgeSuffix}` : ''}
        </span>
      </div>
    </div>
  );
};

export default ParticipantTile;
