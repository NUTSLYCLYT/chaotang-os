import type { ConsultMessage } from "./chancellorConsultStatus";

const STORAGE_PREFIX = "chaotang:consult:v1:";
const STORAGE_VERSION = 1;
const MAX_STORED_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;

export interface ConsultStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function chancellorConsultStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

function isCompleteConversation(value: unknown): value is ConsultMessage[] {
  if (!Array.isArray(value) || value.length > MAX_STORED_MESSAGES || value.length % 2 !== 0) {
    return false;
  }
  return value.every((message, index) => {
    if (!message || typeof message !== "object") return false;
    const candidate = message as Record<string, unknown>;
    const expectedRole = index % 2 === 0 ? "user" : "assistant";
    return candidate.role === expectedRole &&
      typeof candidate.content === "string" &&
      candidate.content.trim().length > 0 &&
      candidate.content.length <= MAX_MESSAGE_LENGTH &&
      Object.keys(candidate).length === 2;
  });
}

export function loadChancellorConsultMessages(
  userId: string,
  storage: ConsultStorage,
): ConsultMessage[] {
  try {
    const raw = storage.getItem(chancellorConsultStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { version?: unknown; messages?: unknown };
    return parsed.version === STORAGE_VERSION && isCompleteConversation(parsed.messages)
      ? parsed.messages.map((message) => ({ ...message }))
      : [];
  } catch {
    return [];
  }
}

export function saveChancellorConsultMessages(
  userId: string,
  messages: ConsultMessage[],
  storage: ConsultStorage,
): void {
  try {
    const retained = messages.slice(-MAX_STORED_MESSAGES);
    if (!isCompleteConversation(retained)) return;
    storage.setItem(
      chancellorConsultStorageKey(userId),
      JSON.stringify({ version: STORAGE_VERSION, messages: retained }),
    );
  } catch {
    // Browser storage may be disabled or full; consultation must remain usable.
  }
}
