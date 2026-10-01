// View models describing the shapes returned by the real API.
import type { User } from '../context/AuthContext';

export type { User };

// GET /user/connections -> data.connections[] 
export interface ConnectionVM {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
  myRole: 'SENDER' | 'RECEIVER';
  contact: { id: string; name: string; email: string };
  requester?: { id: string; name: string; email: string };
  receiver?: { id: string; name: string; email: string };
  receiverId?: string;
}

// GET /user/connections/search -> data.users[] 
export interface SearchUserVM {
  id: string;
  name: string;
  email: string;
}

export interface MessageVM {
  id: string;
  connectionId: string;
  senderId: string;
  receiverId: string;
  body: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  readAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

// GET /user/messages/summary -> data.summaries[]
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

// GET /user/plans -> data.plans[]
export interface PlanVM {
  id: string;
  name: string;
  price: number;
  billingPeriod?: 'month' | '3_months' | '6_months' | 'year' | string;
  monthlyTokenQuota: number;
  videoRatePerMinute: number;
  recordingRatePerMinute: number;
  transcriptionRatePerMinute: number;
  geminiRatePerRequest: number;
}

// GET /user/subscription -> data.subscription 
export interface SubscriptionVM {
  planId: string;
  status: string;
  currentPeriodEnd?: string;
  plan: PlanVM;
}

export interface LedgerEntryVM {
  id: string;
  createdAt: string;
  transactionType: string;
  amount: number;
  balanceAfter?: number;
}

// CallRoom chat/transcription list item 
export interface ChatMessageVM {
  id: string;
  sender: string; 
  text: string;
  self: boolean; 
}

// Pre-join -> Call handoff 
export interface PreJoinConfig {
  callId: string | null;
  room: string;
  token: string | null;
  selectedCameraId?: string;
  selectedMicId?: string;
  /** Facing of the camera the user previewed, so the call starts on the same lens. */
  cameraFacingMode?: 'user' | 'environment';
  cameraEnabled: boolean;
  micEnabled: boolean;
}

export interface NotificationVM {
  id: string;
  userId: string;
  type:
    | 'CALL_INCOMING'
    | 'MESSAGE_RECEIVED'
    | 'PAYMENT_SUCCESS'
    | 'PLAN_UPGRADE'
    | 'CONNECTION_REQUEST'
    | 'CONNECTION_ACCEPTED'
    | 'SYSTEM';
  title: string;
  message: string;
  data: Record<string, any>;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface DashboardAnalyticsVM {
  period: 'week' | 'month';
  days: number;
  breakdown: {
    videoCalls: number;
    callRecordings: number;
    liveTranscriptions: number;
    geminiQueries: number;
    totalSpent: number;
  };
  dailySeries: Array<{
    date: string;
    label: string;
    video: number;
    recording: number;
    transcription: number;
    gemini: number;
    total: number;
  }>;
  quotaTracker: {
    monthlyLimit: number;
    currentBalance: number;
    totalSpendableTokens?: number;
    consumedThisCycle: number;
    percentConsumed: number;
    daysRemaining: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    billingPeriod?: string;
    planName: string;
  };
}

export interface ScheduledCallVM {
  id: string;
  userId: string;
  title: string;
  roomName: string;
  scheduledAt: string;
  durationMinutes: number;
  participants: string[];
  autoScribe: boolean;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface RecentMeetingVM {
  id: string;
  roomName: string;
  title: string;
  date: string;
  durationSeconds: number;
  partner?: { id: string; name: string; avatarUrl?: string | null } | null;
  hasRecording: boolean;
  recordingId?: string | null;
  recordingName?: string | null;
  hasTranscript: boolean;
  hasSummary: boolean;
  summaryPreview?: string | null;
}

export interface ActionItemVM {
  id: string;
  userId: string;
  callId?: string | null;
  text: string;
  sourceMeeting?: string | null;
  completed: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: string;
}

export interface KeyTopicVM {
  topic: string;
  count: number;
  sentiment: 'positive' | 'neutral' | 'urgent';
  category: string;
  relevance: number;
}

