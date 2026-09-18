// Pure date/time helpers for the Messages page. Uses the platform Intl API
// (same approach as Library.tsx) — no new date library is introduced.

/** Short clock time, e.g. "10:32 AM". */
export function formatTime(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(d);
}

/** Day/month, e.g. "18 Sep". */
export function formatDayMonth(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short'
  }).format(d);
}

/**
 * Compact timestamp for conversation lists / message meta:
 *  - today            -> "10:32 AM"
 *  - yesterday        -> "Yesterday"
 *  - within this year -> "18 Sep"
 *  - older            -> "18 Sep 2024"
 */
export function formatRelative(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000);

  if (dayDiff <= 0) return formatTime(d);
  if (dayDiff === 1) return 'Yesterday';
  if (d.getFullYear() === now.getFullYear()) return formatDayMonth(d);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d);
}

/** Section divider label for message groups: "Today", "Yesterday", or a date. */
export function formatDayLabel(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000);

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric'
  }).format(d);
}

/** Stable day key ("YYYY-MM-DD") used to group messages into date sections. */
export function dayKey(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}
