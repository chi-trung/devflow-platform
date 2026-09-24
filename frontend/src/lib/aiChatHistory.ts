import type { AiExecuteResponse } from "../types/api";
import type { AiHistoryTurn } from "./api";

/**
 * Chat transcript for the AI assistant panel. `result` is the full execute
 * response so Accept/Reject cards survive a reload (contract stays on
 * pending actions).
 */
export interface ChatMessage {
  role: "user" | "assistant";
  prompt?: string;
  result?: AiExecuteResponse;
}

/** Cap on messages kept in localStorage — oldest are dropped on save so a
 *  long session cannot blow the quota or make the list unbounded. */
export const MAX_STORED_MESSAGES = 50;

/** Cap on prior turns re-sent to the model — enough for a full clarification
 *  exchange without ballooning the prompt. */
export const MAX_HISTORY_TURNS = 12;

/** Per-turn text cap when flattening history for the model — one huge
 *  summary/error must not dominate the context window. */
export const MAX_TURN_CHARS = 500;

const KEY_PREFIX = "devflow.aiChat.";

export function aiChatHistoryKey(workspaceId: string): string {
  return `${KEY_PREFIX}${workspaceId}`;
}

/** Drops oldest messages beyond `max` so storage and the visible list stay
 *  bounded. */
export function pruneMessages(
  messages: ChatMessage[],
  max: number = MAX_STORED_MESSAGES,
): ChatMessage[] {
  return messages.length <= max ? messages : messages.slice(-max);
}

function truncateTurn(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_TURN_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_TURN_CHARS - 1)}…`;
}

/**
 * Flattens the transcript into role/text turns the backend injects into the
 * model context. Collects every turn first, then keeps the last
 * MAX_HISTORY_TURNS — slicing ChatMessages first would under-count when some
 * messages flatten to nothing. Each turn is truncated so a single long reply
 * cannot flood the prompt.
 */
export function buildHistory(messages: ChatMessage[]): AiHistoryTurn[] {
  const turns: AiHistoryTurn[] = [];
  for (const message of messages) {
    if (message.role === "user" && message.prompt?.trim()) {
      turns.push({ role: "user", text: truncateTurn(message.prompt) });
    } else if (message.role === "assistant" && message.result) {
      const parts = [
        message.result.summary?.trim(),
        message.result.error?.trim(),
        // Clarification bullets live on replyItems when the model skips a
        // one-line summary — dropping them loses the question the user answers.
        ...(message.result.replyItems ?? []).map((item) => item.trim()),
        ...message.result.actions.map((a) => a.message?.trim()),
      ].filter((s): s is string => !!s && s.length > 0);
      if (parts.length > 0) {
        turns.push({ role: "assistant", text: truncateTurn(parts.join(" ")) });
      }
    }
  }
  return turns.slice(-MAX_HISTORY_TURNS);
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  if (m.role !== "user" && m.role !== "assistant") return false;
  if (m.prompt !== undefined && typeof m.prompt !== "string") return false;
  if (m.result !== undefined && m.result !== null) {
    const r = m.result as Record<string, unknown>;
    if (typeof r !== "object" || !Array.isArray(r.actions)) return false;
  }
  return true;
}

/** Reads the persisted transcript for a workspace. Corrupt or hostile JSON
 *  falls back to `[]` (history is a UX cache, not authoritative state). */
export function loadAiChatHistory(workspaceId: string): ChatMessage[] {
  if (!workspaceId) return [];
  try {
    const raw = localStorage.getItem(aiChatHistoryKey(workspaceId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return pruneMessages(parsed.filter(isChatMessage));
  } catch {
    return [];
  }
}

/** Persists the transcript (pruned). Returns false on quota / private-mode
 *  failure — the panel keeps in-memory history either way. */
export function saveAiChatHistory(
  workspaceId: string,
  messages: ChatMessage[],
): boolean {
  if (!workspaceId) return false;
  try {
    localStorage.setItem(
      aiChatHistoryKey(workspaceId),
      JSON.stringify(pruneMessages(messages)),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearAiChatHistory(workspaceId: string): boolean {
  if (!workspaceId) return false;
  try {
    localStorage.removeItem(aiChatHistoryKey(workspaceId));
    return true;
  } catch {
    return false;
  }
}
