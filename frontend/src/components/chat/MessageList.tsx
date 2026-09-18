import React, { useEffect, useRef } from 'react';
import type { MessageVM } from '../../types/viewModels';
import { formatTime, formatDayLabel, dayKey } from '../../lib/messageTime';

interface MessageListProps {
  messages: MessageVM[];
  currentUserId: string | null;
  peerName: string;
  peerTyping: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/** Scrollable, date-grouped message history with sent/received distinction. */
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
        return (
          <React.Fragment key={m.id}>
            {showDivider && (
              <div className="msgx-daydivider">{formatDayLabel(m.createdAt)}</div>
            )}
            <div className={`msgx-row ${mine ? 'msgx-row--self' : 'msgx-row--other'}`}>
              <div>
                <div className="msgx-bubble">{m.body}</div>
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
