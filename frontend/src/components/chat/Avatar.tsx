import React from 'react';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]);
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 'md', online }) => {
  const cls = ['msgx-avatar'];
  if (size === 'sm') cls.push('msgx-avatar--sm');
  if (size === 'lg') cls.push('msgx-avatar--lg');
  return (
    <span className={cls.join(' ')} aria-hidden="true">
      {initials(name)}
      {online !== undefined && (
        <span className={`msgx-avatar__dot${online ? '' : ' msgx-avatar__dot--offline'}`} />
      )}
    </span>
  );
};

export default Avatar;
