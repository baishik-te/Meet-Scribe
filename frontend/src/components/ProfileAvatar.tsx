import React, { useRef, useState } from 'react';
import { resolveUploadUrl } from '../api/files';

interface ProfileAvatarUser {
  name?: string;
  avatarUrl?: string | null;
}

interface ProfileAvatarProps {
  user?: ProfileAvatarUser | null;
  size?: number;
  editable?: boolean;
  onUpload?: (file: File) => void | Promise<void>;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[parts.length - 1][0];
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  user,
  size = 40,
  editable = false,
  onUpload,
  className,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const label = user?.name?.trim() ?? '';
  const src = resolveUploadUrl(user?.avatarUrl);
  const showImage = Boolean(src) && !imgFailed;

  const classes = ['profile-avatar'];
  if (editable) classes.push('profile-avatar--editable');
  if (className) classes.push(className);

  return (
    <span
      className={classes.join(' ')}
      style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.36)) }}
    >
      {showImage ? (
        <img
          className="profile-avatar__img"
          src={src}
          alt={label ? `${label}'s profile photo` : 'Profile photo'}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="profile-avatar__initials" aria-hidden="true">
          {initials(label)}
        </span>
      )}
      {editable && (
        <>
          <button
            type="button"
            className="profile-avatar__upload"
            title="Upload photo"
            aria-label="Upload profile photo"
            onClick={() => inputRef.current?.click()}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
              <path d="M9 2 7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9Zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5Z" />
            </svg>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="profile-avatar__input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file && onUpload) void onUpload(file);
            }}
          />
        </>
      )}
    </span>
  );
};

export default ProfileAvatar;
