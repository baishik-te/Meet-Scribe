import React from 'react';

interface VerifiedBadgeProps {
  size?: number;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ size = 18 }) => (
  <svg
    className="verified-badge"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    role="img"
    aria-label="Verified"
  >
    <title>Verified</title>
    <circle cx="12" cy="12" r="10" fill="var(--accent-blue)" />
    <path
      d="m8.2 12.3 2.5 2.5 5.1-5.1"
      stroke="#ffffff"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default VerifiedBadge;
