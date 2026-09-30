const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

export function resolveUploadUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}
