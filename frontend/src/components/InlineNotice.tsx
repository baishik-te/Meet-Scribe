import React from 'react';

export type InlineNoticeVariant = 'error' | 'info' | 'success';

interface InlineNoticeProps {
  /** Message text to display. If falsy, nothing is rendered. */
  message?: string | null;
  /** Visual variant. Defaults to 'info'. Errors are styled with --accent-red. */
  variant?: InlineNoticeVariant;
  /**
   * Optional dismiss callback. When provided, a dismiss button is shown so the
   * notice is non-blocking and can be cleared by the user.
   */
  onDismiss?: () => void;
  /** Optional extra class names. */
  className?: string;
}

/**
 * InlineNotice renders a lightweight, non-blocking, theme-styled notice used to
 * surface transient errors, info, and confirmations in place of alert()/console.error.
 *
 * It relies on the existing theme.css classes:
 *  - `.inline-notice` (base surface)
 *  - `.inline-notice--error` (error variant, uses --accent-red)
 *
 * The notice is dismissible when `onDismiss` is provided and never blocks the UI.
 */
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
