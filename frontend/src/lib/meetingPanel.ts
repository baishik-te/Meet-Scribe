// Pure, dependency-free helpers for the Meeting_Panel chat/transcription list.
//
// Extracted so they can be unit- and property-tested in isolation (no React,
// no socket, no network). Task 14.9's property test imports `toChatMessageVM`
// / `isSelfMessage` to assert the self-vs-other classification.
//
// Design: "CallRoom → Meeting_Panel", Requirement 9.6 (own messages aligned
// distinctly; own = `speakerName === user?.name`).

import type { ChatMessageVM } from '../types/viewModels';

/**
 * A raw chat/transcription entry before it is classified for rendering.
 * Mirrors what a `transcription:new` socket event or a composer submit yields.
 */
export interface RawChatMessage {
  id: string;
  sender: string; // speakerName
  text: string;
}

/**
 * Whether a message belongs to the current user (Requirement 9.6).
 *
 * A message is "self" iff its `sender` (speaker name) equals the current
 * user's name. A missing/empty current user name never matches, so such
 * messages are always classified as "other".
 */
export function isSelfMessage(
  sender: string,
  currentUserName: string | null | undefined
): boolean {
  return Boolean(currentUserName) && sender === currentUserName;
}

/**
 * Map a raw message + the current user's name to a `ChatMessageVM`
 * (Requirement 9.6). The resulting `self` flag drives the `.msg--self` /
 * `.msg--other` alignment classes in the render.
 */
export function toChatMessageVM(
  raw: RawChatMessage,
  currentUserName: string | null | undefined
): ChatMessageVM {
  return {
    id: raw.id,
    sender: raw.sender,
    text: raw.text,
    self: isSelfMessage(raw.sender, currentUserName),
  };
}
