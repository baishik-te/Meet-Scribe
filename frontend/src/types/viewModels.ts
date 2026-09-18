// View models describing the shapes returned by the real API.
// These replace the current `any[]` usages across redesigned pages.
//
// The `User` interface is defined in and reused from `AuthContext.tsx`.
// Re-exported here for convenience so pages can import a single type module.
import type { User } from '../context/AuthContext';

export type { User };

/** GET /user/connections -> data.connections[] */
export interface ConnectionVM {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
  myRole: 'SENDER' | 'RECEIVER';
  contact: { id: string; name: string; email: string };
  // Meetings page also derives partner via requester/receiver on some shapes
  requester?: { id: string; name: string; email: string };
  receiver?: { id: string; name: string; email: string };
  receiverId?: string;
}

/** GET /user/connections/search -> data.users[] */
export interface SearchUserVM {
  id: string;
  name: string;
  email: string;
}

/** A single direct message within an accepted connection thread. */
export interface MessageVM {
  id: string;
  connectionId: string;
  senderId: string;
  receiverId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

/** GET /user/messages/summary -> data.summaries[] (per-connection preview) */
export interface MessageSummaryVM {
  connectionId: string;
  lastMessage: {
    id: string;
    body: string;
    senderId: string;
    createdAt: string;
  };
  unreadCount: number;
}

/** GET /user/plans -> data.plans[] */
export interface PlanVM {
  id: string;
  name: string;
  price: number;
  monthlyTokenQuota: number;
  videoRatePerMinute: number;
  recordingRatePerMinute: number;
  transcriptionRatePerMinute: number;
  geminiRatePerRequest: number;
}

/** GET /user/subscription -> data.subscription */
export interface SubscriptionVM {
  planId: string;
  status: string;
  currentPeriodEnd?: string;
  plan: PlanVM;
}

/** GET /user/wallet/ledger -> data.entries[] */
export interface LedgerEntryVM {
  id: string;
  createdAt: string;
  transactionType: string;
  amount: number;
  balanceAfter?: number;
}

/** CallRoom chat/transcription list item */
export interface ChatMessageVM {
  id: string;
  sender: string; // speakerName
  text: string;
  self: boolean; // sender === user?.name
}

/** Pre-join -> Call handoff */
export interface PreJoinConfig {
  callId: string | null;
  room: string;
  token: string | null;
  selectedCameraId?: string;
  selectedMicId?: string;
  cameraEnabled: boolean;
  micEnabled: boolean;
}
