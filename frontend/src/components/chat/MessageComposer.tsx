import React, { useEffect, useRef, useState } from 'react';
import { EmojiIcon, AttachIcon, ImageIcon, SendIcon, CloseIcon, FileIcon } from './icons';

interface MessageComposerProps {
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
  disabledPlaceholder?: string;
  onSend: (text: string, file?: File | null) => void;
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
  placeholder = 'Type a message',
  disabledPlaceholder = 'Select a conversation to start chatting',
  onSend,
  onTyping
}) => {
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const emojiRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!emojiOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [emojiOpen]);

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }

    // Reset input so re-selecting the same file fires onChange
    e.target.value = '';
    inputRef.current?.focus();
  };

  const removeFile = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(null);
    setFilePreview(null);
  };

  const submit = () => {
    if (disabled || sending) return;
    const trimmed = text.trim();
    if (!trimmed && !selectedFile) return;

    onSend(trimmed, selectedFile);
    setText('');
    removeFile();
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

  const canSend = !disabled && !sending && (Boolean(text.trim()) || Boolean(selectedFile));

  return (
    <div className="msgx-composer-container">
      {/* Attachment Preview Tray */}
      {selectedFile && (
        <div className="msgx-attachment-preview">
          <div className="msgx-attachment-preview__info">
            {filePreview ? (
              <img src={filePreview} alt="Selected preview" className="msgx-attachment-preview__thumb" />
            ) : (
              <div className="msgx-attachment-preview__icon">
                <FileIcon size={20} />
              </div>
            )}
            <div className="msgx-attachment-preview__meta">
              <span className="msgx-attachment-preview__name" title={selectedFile.name}>
                {selectedFile.name}
              </span>
              <span className="msgx-attachment-preview__size">
                {selectedFile.size / 1024 < 1024
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                  : `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="msgx-attachment-preview__close"
            onClick={removeFile}
            aria-label="Remove attachment"
            title="Remove file"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}

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

          {/* Attach any Document / File */}
          <button
            type="button"
            className="msgx-iconbtn"
            aria-label="Attach file"
            title="Attach file or document"
            disabled={disabled || sending}
            onClick={() => fileInputRef.current?.click()}
          >
            <AttachIcon />
          </button>

          {/* Attach Image from Gallery */}
          <button
            type="button"
            className="msgx-iconbtn"
            aria-label="Attach image"
            title="Attach image from gallery"
            disabled={disabled || sending}
            onClick={() => imageInputRef.current?.click()}
          >
            <ImageIcon />
          </button>

          {/* Hidden File Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        <div className="msgx-composer__field">
          <textarea
            ref={inputRef}
            className="msgx-composer__input"
            rows={1}
            placeholder={
              disabled
                ? disabledPlaceholder
                : selectedFile
                ? 'Add a caption (optional)…'
                : placeholder
            }
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
          disabled={!canSend}
          onClick={submit}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
};

export default MessageComposer;
