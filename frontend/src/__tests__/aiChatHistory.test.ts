import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_HISTORY_TURNS,
  MAX_STORED_MESSAGES,
  MAX_TURN_CHARS,
  aiChatHistoryKey,
  buildHistory,
  clearAiChatHistory,
  loadAiChatHistory,
  pruneMessages,
  saveAiChatHistory,
  type ChatMessage,
} from "../lib/aiChatHistory";

function user(prompt: string): ChatMessage {
  return { role: "user", prompt };
}

function assistant(summary: string): ChatMessage {
  return {
    role: "assistant",
    result: {
      summary,
      actions: [],
      error: null,
    },
  };
}

function assistantWithActions(...messages: string[]): ChatMessage {
  return {
    role: "assistant",
    result: {
      summary: null,
      actions: messages.map((message) => ({
        type: "assign_task",
        label: message,
        entityId: null,
        status: "success" as const,
        message,
      })),
      error: null,
    },
  };
}

describe("pruneMessages", () => {
  it("keeps the array when under the cap", () => {
    const list = [user("a"), assistant("b")];
    expect(pruneMessages(list, 5)).toBe(list);
  });

  it("drops oldest messages beyond the cap", () => {
    const list = Array.from({ length: 10 }, (_, i) => user(`m${i}`));
    const pruned = pruneMessages(list, 4);
    expect(pruned).toHaveLength(4);
    expect(pruned[0].prompt).toBe("m6");
    expect(pruned[3].prompt).toBe("m9");
  });

  it("defaults to MAX_STORED_MESSAGES", () => {
    const list = Array.from({ length: MAX_STORED_MESSAGES + 5 }, (_, i) =>
      user(`m${i}`),
    );
    expect(pruneMessages(list)).toHaveLength(MAX_STORED_MESSAGES);
  });
});

describe("buildHistory", () => {
  it("flattens user prompts and assistant summaries in order", () => {
    const turns = buildHistory([
      user("  create a task  "),
      assistant(" Created login "),
      user("assign to Alice"),
      assistantWithActions("Assigned to Alice", "Due Friday"),
    ]);

    expect(turns).toEqual([
      { role: "user", text: "create a task" },
      { role: "assistant", text: "Created login" },
      { role: "user", text: "assign to Alice" },
      { role: "assistant", text: "Assigned to Alice Due Friday" },
    ]);
  });

  it("keeps the last MAX_HISTORY_TURNS after flattening, not raw messages", () => {
    // 16 user+assistant pairs = 32 messages → 32 turns after flatten.
    // Slicing ChatMessages first at 12 would keep only 6 exchanges.
    const messages: ChatMessage[] = [];
    for (let i = 0; i < MAX_HISTORY_TURNS + 4; i++) {
      messages.push(user(`u${i}`));
      messages.push(assistant(`a${i}`));
    }
    const turns = buildHistory(messages);
    expect(turns).toHaveLength(MAX_HISTORY_TURNS);
    // 32 turns → keep last 12 → start at turn index 20 = u10; end at a15.
    expect(turns[0]).toEqual({ role: "user", text: "u10" });
    expect(turns[turns.length - 1]).toEqual({ role: "assistant", text: "a15" });
  });

  it("truncates a single long turn to MAX_TURN_CHARS", () => {
    const long = "x".repeat(MAX_TURN_CHARS + 100);
    const turns = buildHistory([user(long)]);
    expect(turns[0].text.length).toBeLessThanOrEqual(MAX_TURN_CHARS);
    expect(turns[0].text.endsWith("…")).toBe(true);
  });

  it("skips empty user prompts and assistant messages with nothing to say", () => {
    const turns = buildHistory([
      { role: "user", prompt: "   " },
      { role: "assistant", result: { summary: null, actions: [], error: null } },
      user("real"),
    ]);
    expect(turns).toEqual([{ role: "user", text: "real" }]);
  });

  it("includes assistant error text so a failed turn still conditions the next", () => {
    const turns = buildHistory([
      {
        role: "assistant",
        result: {
          summary: null,
          actions: [],
          error: "AI timed out",
        },
      },
    ]);
    expect(turns).toEqual([{ role: "assistant", text: "AI timed out" }]);
  });

  it("includes replyItems so a clarification question survives into history", () => {
    const turns = buildHistory([
      {
        role: "assistant",
        result: {
          summary: null,
          actions: [],
          error: null,
          replyItems: ["Which member should I assign to?"],
        },
      },
      user("Alice"),
    ]);
    expect(turns[0]).toEqual({
      role: "assistant",
      text: "Which member should I assign to?",
    });
    expect(turns[1]).toEqual({ role: "user", text: "Alice" });
  });
});

describe("load / save / clear", () => {
  const workspaceId = "ws-history-test";

  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips a transcript under the workspace key", () => {
    const messages = [user("hi"), assistant("hello")];
    expect(saveAiChatHistory(workspaceId, messages)).toBe(true);
    expect(localStorage.getItem(aiChatHistoryKey(workspaceId))).toBeTruthy();
    expect(loadAiChatHistory(workspaceId)).toEqual(messages);
  });

  it("prunes on save so storage never exceeds MAX_STORED_MESSAGES", () => {
    const messages = Array.from({ length: MAX_STORED_MESSAGES + 10 }, (_, i) =>
      user(`m${i}`),
    );
    saveAiChatHistory(workspaceId, messages);
    expect(loadAiChatHistory(workspaceId)).toHaveLength(MAX_STORED_MESSAGES);
  });

  it("returns [] for a missing or corrupt payload", () => {
    expect(loadAiChatHistory(workspaceId)).toEqual([]);
    localStorage.setItem(aiChatHistoryKey(workspaceId), "{not json");
    expect(loadAiChatHistory(workspaceId)).toEqual([]);
    localStorage.setItem(aiChatHistoryKey(workspaceId), '{"nope":1}');
    expect(loadAiChatHistory(workspaceId)).toEqual([]);
  });

  it("filters entries that are not ChatMessages", () => {
    localStorage.setItem(
      aiChatHistoryKey(workspaceId),
      JSON.stringify([
        user("ok"),
        { role: "system", prompt: "evil" },
        { role: "assistant", result: "not-an-object" },
        assistant("kept"),
      ]),
    );
    const loaded = loadAiChatHistory(workspaceId);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].prompt).toBe("ok");
    expect(loaded[1].result?.summary).toBe("kept");
  });

  it("isolates history per workspace", () => {
    saveAiChatHistory("ws-a", [user("from a")]);
    saveAiChatHistory("ws-b", [user("from b")]);
    expect(loadAiChatHistory("ws-a")).toEqual([user("from a")]);
    expect(loadAiChatHistory("ws-b")).toEqual([user("from b")]);
    clearAiChatHistory("ws-a");
    expect(loadAiChatHistory("ws-a")).toEqual([]);
    expect(loadAiChatHistory("ws-b")).toEqual([user("from b")]);
  });

  it("clearAiChatHistory removes the key", () => {
    saveAiChatHistory(workspaceId, [user("x")]);
    expect(clearAiChatHistory(workspaceId)).toBe(true);
    expect(localStorage.getItem(aiChatHistoryKey(workspaceId))).toBeNull();
  });

  it("rejects empty workspace ids without touching storage", () => {
    expect(saveAiChatHistory("", [user("x")])).toBe(false);
    expect(loadAiChatHistory("")).toEqual([]);
    expect(clearAiChatHistory("")).toBe(false);
  });
});

