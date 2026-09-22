import type { ChatMessageVM } from '../types/viewModels';


export interface RawChatMessage {
  id: string;
  sender: string; // speakerName
  text: string;
}

export function isSelfMessage(
  sender: string,
  currentUserName: string | null | undefined
): boolean {
  return Boolean(currentUserName) && sender === currentUserName;
}

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
