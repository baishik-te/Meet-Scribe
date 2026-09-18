// Pure, dependency-free helpers for the Connections page.
//
// These are extracted so they can be unit- and property-tested in isolation
// (no React, no network). Both are referentially transparent.
//
// Design: "Connections redesign → Chat_Layout", Property 3 (action mapping)
// and Property 5 (search-query validation).

import type { ConnectionVM } from '../types/viewModels';

/**
 * Search-query validation predicate (Property 5 / Requirements 4.2, 4.3).
 *
 * A query is valid — and therefore permitted to call
 * `GET /user/connections/search` — if and only if it has at least one
 * non-whitespace character after trimming and is no longer than 100 chars.
 */
export function isValidSearchQuery(q: string): boolean {
  return q.trim().length >= 1 && q.length <= 100;
}

/** The discrete actions the Connections main pane can expose for a connection. */
export type ConnectionAction =
  | 'start-call'
  | 'accept'
  | 'reject'
  | 'cancel'
  | 'block'
  | 'unblock'
  | 'status-label';

/**
 * Pure mapping from (status, myRole) to the set of available actions
 * (Property 3 / Requirements 4.4, 4.5, 4.6, 4.7, 4.12).
 *
 * - ACCEPTED                -> ['start-call']
 * - PENDING + RECEIVER      -> ['accept', 'reject']
 * - PENDING + SENDER        -> ['cancel', 'block']
 * - BLOCKED + SENDER        -> ['unblock']
 * - otherwise               -> ['status-label']
 */
export function connectionActions(
  status: ConnectionVM['status'],
  myRole: ConnectionVM['myRole']
): ConnectionAction[] {
  if (status === 'ACCEPTED') {
    return ['start-call'];
  }
  if (status === 'PENDING' && myRole === 'RECEIVER') {
    return ['accept', 'reject'];
  }
  if (status === 'PENDING' && myRole === 'SENDER') {
    return ['cancel', 'block'];
  }
  if (status === 'BLOCKED' && myRole === 'SENDER') {
    return ['unblock'];
  }
  return ['status-label'];
}
