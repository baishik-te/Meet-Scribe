import React, { useEffect, useRef, useState } from 'react';
import { EmojiIcon, AttachIcon, ImageIcon, SendIcon } from './icons';

interface MessageComposerProps {
  disabled?: boolean;
  sending?: boolean;
  onSend: (text: string) => void;
  onTyping: () => void;
}

// A compact, dependency-free emoji set for the picker (client-side insert only).
const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😎', '😉', '😇', '🙂', '🙃', '😌', '😴', '🤔',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👀', '🔥', '✨', '🎉', '❤️', '💙', '💚', '💛',
  '😢', '😭', '😅', '😳', '😮', '😡', '🥳', '🤝', '👋', '💯', '✅', '❌', '⭐', '☕'
];


export const MessageComposer: React.FC<MessageComposerProps> = ({
  disabled = false,
  sending = false,
  onSend,
  onTyping
}) => {
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!emojiOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [emojiOpen]);


  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const submit = () => {
    if (disabled || sending) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="msgx-composer">
      <div className="msgx-composer__tools">
        <div className="msgx-emoji" ref={emojiRef}>
          <button
            type="button"
            className="msgx-iconbtn"
            aria-label="Insert emoji"
            aria-haspopup="true"
            aria-expanded={emojiOpen}
            title="Emoji"
            disabled={disabled}
            onClick={() => setEmojiOpen((v) => !v)}
          >
            <EmojiIcon />
          </button>
          {emojiOpen && (
            <div className="msgx-emoji__panel" role="menu">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="msgx-emoji__item"
                  onClick={() => insertEmoji(e)}
                  aria-label={`Insert ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="msgx-iconbtn"
          aria-label="Attach file (unavailable)"
          title="Attachments are not available yet"
          disabled
        >
          <AttachIcon />
        </button>
        <button
          type="button"
          className="msgx-iconbtn"
          aria-label="Attach image (unavailable)"
          title="Image sharing is not available yet"
          disabled
        >
          <ImageIcon />
        </button>
      </div>

      <div className="msgx-composer__field">
        <textarea
          ref={inputRef}
          className="msgx-composer__input"
          rows={1}
          placeholder={disabled ? 'Select a conversation to start chatting' : 'Type a message'}
          aria-label="Message"
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) onTyping();
          }}
          onKeyDown={handleKeyDown}
        />
      </div>

      <button
        type="button"
        className="msgx-send"
        aria-label="Send message"
        title="Send"
        disabled={disabled || sending || !text.trim()}
        onClick={submit}
      >
        <SendIcon />
      </button>
    </div>
  );
};

export default MessageComposer;
