import { useState } from 'react';

export interface ComposerProps {
  onSend?: (text: string) => void; // local-only; no backend messaging
  disabled?: boolean;
}

/**
 * Presentational message composer for the Connections chat layout.
 *
 * All controls (emoji, attach, image, send) are presentational only and
 * invoke NO backend messaging endpoint. The send control may call the
 * optional local-only `onSend` callback with the typed text.
 */
export const Composer: React.FC<ComposerProps> = ({ onSend, disabled = false }) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (disabled) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    // Local-only: no backend messaging endpoint is invoked here.
    onSend?.(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="composer">
      <button
        type="button"
        className="composer__btn"
        aria-label="Insert emoji"
        title="Insert emoji"
        disabled={disabled}
        onClick={() => { /* presentational only — no backend */ }}
      >
        😊
      </button>

      <button
        type="button"
        className="composer__btn"
        aria-label="Attach file"
        title="Attach file"
        disabled={disabled}
        onClick={() => { /* presentational only — no backend */ }}
      >
        📎
      </button>

      <button
        type="button"
        className="composer__btn"
        aria-label="Attach image"
        title="Attach image"
        disabled={disabled}
        onClick={() => { /* presentational only — no backend */ }}
      >
        🖼️
      </button>

      <input
        type="text"
        className="composer__input"
        aria-label="Message"
        placeholder="Type a message"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <button
        type="button"
        className="composer__btn"
        aria-label="Send message"
        title="Send message"
        disabled={disabled}
        onClick={handleSend}
      >
        ➤
      </button>
    </div>
  );
};

export default Composer;
