import type { ConnectionVM } from '../types/viewModels';

export interface Partner {
  id: string;
  name: string;
  email: string;
}

/**
 * Resolve the counterpart (the "other" user) of a connection relative to the
 * current logged-in user.
 *
 * The backend (GET /user/connections) already computes this correctly and
 * returns it as `contact` (isRequester ? receiver : requester). We prefer that.
 *
 * When `contact` is absent, we fall back to a current-user-based comparison:
 * if the current user is the requester, the counterpart is the receiver;
 * otherwise the counterpart is the requester. This never yields the current
 * user, regardless of whether they initiated the connection.
 */
export function resolvePartner(c: ConnectionVM, currentUserId: string): Partner {
  // Preferred: backend-resolved counterpart, already relative to the viewer.
  if (c.contact && c.contact.id) {
    return c.contact;
  }

  // Fallback: determine whether the current user initiated (is the requester).
  const currentIsRequester =
    c.requester?.id === currentUserId ||
    (c.requester === undefined && c.receiverId !== undefined && c.receiverId !== currentUserId);

  const counterpart = currentIsRequester ? c.receiver : c.requester;
  if (counterpart) return counterpart;

  // Last-resort: whichever nested user is present and is not the current user.
  if (c.requester && c.requester.id !== currentUserId) return c.requester;
  if (c.receiver && c.receiver.id !== currentUserId) return c.receiver;

  return { id: '', name: '', email: '' };
}
