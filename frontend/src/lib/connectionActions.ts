
import type { ConnectionVM } from '../types/viewModels';


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
