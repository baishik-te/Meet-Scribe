import React, { useEffect, useRef } from 'react';
import type { MessageVM } from '../../types/viewModels';
import { formatTime, formatDayLabel, dayKey } from '../../lib/messageTime';
import { API_BASE_URL } from '../../api/client';
import { FileIcon, DownloadIcon } from './icons';

interface MessageListProps {
  messages: MessageVM[];
  currentUserId: string | null;
  peerName: string;
  peerTyping: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function getMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  const root = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${root}${cleanPath}`;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(fileType?: string | null, fileName?: string | null): boolean {
  if (fileType?.startsWith('image/')) return true;
  if (fileName && /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName)) return true;
  return false;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  peerName,
  peerTyping,
  loading,
  error,
  onRetry
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message when the thread or typing state changes.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, peerTyping]);

  if (loading) {
    return <div className="msgx-history"><div className="msgx-loading">Loading messages…</div></div>;
  }

  if (error) {
    return (
      <div className="msgx-history">
        <div className="msgx-loading">
          <div style={{ marginBottom: 10 }}>{error}</div>
          <button type="button" className="msgx-btn-sm" onClick={onRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="msgx-history">
        <div className="msgx-loading">
          No messages yet. Say hello to {peerName}.
        </div>
        <div ref={bottomRef} />
      </div>
    );
  }

  let lastDay = '';

  return (
    <div className="msgx-history" role="log" aria-label="Message history">
      {messages.map((m) => {
        const mine = m.senderId === currentUserId;
        const key = dayKey(m.createdAt);
        const showDivider = key !== lastDay;
        lastDay = key;

        const hasAttachment = Boolean(m.fileUrl);
        const isImg = hasAttachment && isImage(m.fileType, m.fileName);

        return (
          <React.Fragment key={m.id}>
            {showDivider && (
              <div className="msgx-daydivider">{formatDayLabel(m.createdAt)}</div>
            )}
            <div className={`msgx-row ${mine ? 'msgx-row--self' : 'msgx-row--other'}`}>
              <div>
                <div className={`msgx-bubble ${hasAttachment ? 'msgx-bubble--with-attachment' : ''}`}>
                  {/* Image Attachment Preview */}
                  {hasAttachment && isImg && (
                    <div className="msgx-bubble__image-wrap">
                      <a
                        href={getMediaUrl(m.fileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Click to view full image"
                      >
                        <img
                          src={getMediaUrl(m.fileUrl)}
                          alt={m.fileName || 'Image attachment'}
                          className="msgx-bubble__image"
                          loading="lazy"
                        />
                      </a>
                    </div>
                  )}

                  {/* File Attachment Card */}
                  {hasAttachment && !isImg && (
                    <div className="msgx-bubble__file-card">
                      <div className="msgx-bubble__file-icon">
                        <FileIcon size={24} />
                      </div>
                      <div className="msgx-bubble__file-info">
                        <span className="msgx-bubble__file-name" title={m.fileName || 'Attachment'}>
                          {m.fileName || 'Attachment'}
                        </span>
                        {m.fileSize ? (
                          <span className="msgx-bubble__file-size">{formatBytes(m.fileSize)}</span>
                        ) : null}
                      </div>
                      <a
                        href={getMediaUrl(m.fileUrl)}
                        download={m.fileName || 'file'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="msgx-bubble__file-download"
                        title={`Download ${m.fileName || 'file'}`}
                        aria-label={`Download ${m.fileName || 'file'}`}
                      >
                        <DownloadIcon size={16} />
                      </a>
                    </div>
                  )}

                  {/* Text body if different from fileName or if regular text message */}
                  {m.body && (!hasAttachment || m.body !== m.fileName) && (
                    <div className={hasAttachment ? 'msgx-bubble__caption' : undefined}>
                      {m.body}
                    </div>
                  )}
                </div>

                <div className="msgx-meta">
                  <span>{formatTime(m.createdAt)}</span>
                  {mine && (
                    <span
                      className={`msgx-tick${m.readAt ? ' is-read' : ''}`}
                      title={m.readAt ? 'Read' : 'Sent'}
                    >
                      {m.readAt ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}

      {peerTyping && <div className="msgx-typing">{peerName} is typing…</div>}

      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
