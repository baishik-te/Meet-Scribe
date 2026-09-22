import React from 'react';

export type InlineNoticeVariant = 'error' | 'info' | 'success';

interface InlineNoticeProps {
  
  message?: string | null;
  variant?: InlineNoticeVariant;
  onDismiss?: () => void;
  className?: string;
}


export const InlineNotice: React.FC<InlineNoticeProps> = ({
  message,
  variant = 'info',
  onDismiss,
  className,
}) => {
  if (!message) {
    return null;
  }

  const classes = ['inline-notice'];
  if (variant === 'error') {
    classes.push('inline-notice--error');
  }
  if (className) {
    classes.push(className);
  }

  return (
    <div
      className={classes.join(' ')}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
    >
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notice"
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: 0,
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
};

export default InlineNotice;
