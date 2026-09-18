import React from 'react';

// Small inline SVG icon set for the Messages page. Currentcolor-driven so they
// inherit themed text colors. Sized 18px by default.
interface IconProps {
  size?: number;
}

export const SearchIcon: React.FC<IconProps> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const VideoIcon: React.FC<IconProps> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17 10.5V7C17 5.9 16.1 5 15 5H4C2.9 5 2 5.9 2 7V17C2 18.1 2.9 19 4 19H15C16.1 19 17 18.1 17 17V13.5L21 17.5V6.5L17 10.5Z" />
  </svg>
);

export const PeopleIcon: React.FC<IconProps> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16 11C17.66 11 18.99 9.66 18.99 8C18.99 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 10.99 9.66 10.99 8C10.99 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V19H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C16.19 13.89 17 15.02 17 16.5V19H23V16.5C23 14.17 18.33 13 16 13Z" />
  </svg>
);

export const MoreIcon: React.FC<IconProps> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);

export const SendIcon: React.FC<IconProps> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" />
  </svg>
);

export const EmojiIcon: React.FC<IconProps> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <circle cx="9" cy="10" r="1.2" fill="currentColor" />
    <circle cx="15" cy="10" r="1.2" fill="currentColor" />
    <path d="M8.5 14.5C9.5 15.8 10.7 16.5 12 16.5C13.3 16.5 14.5 15.8 15.5 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const AttachIcon: React.FC<IconProps> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.5 6V17.5C16.5 19.71 14.71 21.5 12.5 21.5C10.29 21.5 8.5 19.71 8.5 17.5V5C8.5 3.62 9.62 2.5 11 2.5C12.38 2.5 13.5 3.62 13.5 5V15.5C13.5 16.05 13.05 16.5 12.5 16.5C11.95 16.5 11.5 16.05 11.5 15.5V6H10V15.5C10 16.88 11.12 18 12.5 18C13.88 18 15 16.88 15 15.5V5C15 2.79 13.21 1 11 1C8.79 1 7 2.79 7 5V17.5C7 20.54 9.46 23 12.5 23C15.54 23 18 20.54 18 17.5V6H16.5Z" />
  </svg>
);

export const ImageIcon: React.FC<IconProps> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z" />
  </svg>
);

export const ChevronIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 10L12 15L17 10H7Z" />
  </svg>
);

export const ComposeIcon: React.FC<IconProps> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25ZM20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z" />
  </svg>
);

export const BackIcon: React.FC<IconProps> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z" />
  </svg>
);
