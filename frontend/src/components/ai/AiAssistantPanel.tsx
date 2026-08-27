import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { aiExecute, aiExecuteConfirm } from "../../lib/api";
import type {
  AiExecuteResponse,
  AiExecuteActionContract,
  ExecutedAction,
} from "../../types/api";
import { AiActionResults } from "./AiActionResults";
import { AiSuggestedPrompts, type AiPageContext } from "./AiSuggestedPrompts";

/** Max textarea height before it starts scrolling internally. */
const MAX_COMPOSER_ROWS = 5;

interface AiAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  projectId: string | undefined;
  sprintId?: string | null;
  epicId?: string | null;
  context: AiPageContext;
  /** Called after AI actions have been executed (e.g. a task was created) so
   * the parent page can refresh the board / list without a manual F5. */
  onTaskChanged?: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  prompt?: string;
  result?: AiExecuteResponse;
}

export function AiAssistantPanel({
  open,
  onClose,
  workspaceId,
  projectId,
  sprintId,
  epicId,
  context,
  onTaskChanged,
}: AiAssistantPanelProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  /** Index (within its message's actions) of the pending action currently
   * being accepted — disables both buttons on that card while in flight. */
  const [pendingAccepting, setPendingAccepting] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setDraft("");
      // Let the panel mount before focusing so the animation does not swallow it.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        autoGrowComposer();
      });
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || loading) return;

    setMessages((prev) => [...prev, { role: "user", prompt }]);
    setDraft("");
    // Reset the composer to one line now that the draft is cleared.
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);

    try {
      const result = await aiExecute(
        workspaceId,
        projectId,
        {
          prompt,
          pageContext: context,
        },
        { sprintId, epicId },
      );
      setMessages((prev) => [...prev, { role: "assistant", result }]);
      // Mutation actions (set due date, assign…) execute immediately server-side,
      // so let the parent board/list refresh right away. create_* actions stay
      // pending until the user Accepts them (see Fix 3).
      if (result.actions.some((a) => a.status === "success")) {
        onTaskChanged?.();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          result: {
            summary: null,
            actions: [],
            error: t("ai.assistantRequestFailed"),
          },
        },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  /** Replaces the action at `index` in the LAST assistant message with `next` —
   * used to reflect the result of an accept/reject on the pending card. */
  function replaceLastAction(index: number, next: ExecutedAction) {
    setMessages((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === "assistant" && copy[i].result) {
          const actions = [...copy[i].result!.actions];
          actions[index] = next;
          copy[i] = {
            ...copy[i],
            result: { ...copy[i].result!, actions },
          };
          break;
        }
      }
      return copy;
    });
  }

  /** Runs a single accepted action through the confirm endpoint. The card
   * stays disabled until the request settles; on failure the action stays
   * pending so the user can retry. */
  async function handleAccept(action: AiExecuteActionContract, index: number) {
    if (loading || pendingAccepting !== null) return;
    setPendingAccepting(index);
    try {
      const result = await aiExecuteConfirm(workspaceId, projectId, action);
      replaceLastAction(index, result);
      if (result.status === "success") {
        onTaskChanged?.();
      }
    } catch {
      replaceLastAction(index, {
        type: action.type,
        label: action.title ?? action.type,
        entityId: null,
        status: "failed",
        message: t("ai.actionConfirmFailed"),
        contract: action,
      });
    } finally {
      setPendingAccepting(null);
    }
  }

  /** Rejects a pending action — removes it from the review list locally
   * (marking it skipped) so it is never executed. */
  function handleReject(index: number) {
    if (loading || pendingAccepting !== null) return;
    setMessages((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === "assistant" && copy[i].result) {
          const actions = [...copy[i].result!.actions];
          const current = actions[index];
          if (!current || current.status !== "pending") break;
          actions[index] = {
            ...current,
            status: "skipped",
            message: current.message,
            contract: null,
          };
          copy[i] = {
            ...copy[i],
            result: { ...copy[i].result!, actions },
          };
          break;
        }
      }
      return copy;
    });
  }

  /**
   * Auto-grow the composer: reset to natural height, then expand up to the
   * max, so long prompts wrap onto new lines instead of scrolling sideways.
   * The textarea scrolls internally once it exceeds MAX_COMPOSER_ROWS.
   */
  function autoGrowComposer() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    // text-sm line-height is 1.25rem (20px); 5 rows ≈ 100px + py-2 padding.
    const maxPx = MAX_COMPOSER_ROWS * 20 + 16;
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={t("ai.assistant")}
      className="flex h-[min(70dvh,26rem)] w-[min(92vw,26rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.5)] rise"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight text-foreground">
              {t("ai.assistant")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("ai.assistantSubtitle")}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label={t("ui.closeMenuAria")}
          onClick={onClose}
          className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("ai.assistantEmpty")}
          </p>
        )}

        {messages.map((message, i) =>
          message.role === "user" ? (
            <div key={i} className="flex justify-end">
              <span className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary/15 px-3 py-2 text-sm text-foreground">
                {message.prompt}
              </span>
            </div>
          ) : (
            <div key={i}>
              <AiActionResults
                summary={message.result?.summary ?? null}
                actions={message.result?.actions ?? []}
                error={message.result?.error ?? null}
                onAccept={(action, actionIndex) => void handleAccept(action, actionIndex)}
                onReject={handleReject}
                pendingAccepting={pendingAccepting}
              />
            </div>
          ),
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-3.5 animate-spin rounded-full border-2 border-border border-t-primary" />
            {t("ai.assistantThinking")}
          </div>
        )}

        {messages.length === 0 && !loading && (
          <AiSuggestedPrompts
            workspaceId={workspaceId}
            projectId={projectId}
            epicId={epicId}
            context={context}
            onPick={send}
          />
        )}
      </div>

      <footer className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:border-primary/50">
          <textarea
            ref={inputRef}
            value={draft}
            rows={1}
            onChange={(event) => {
              setDraft(event.target.value);
              autoGrowComposer();
            }}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter inserts a newline.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
            placeholder={t("ai.assistantPlaceholder")}
            aria-label={t("ai.assistantPlaceholder")}
            className="max-h-[120px] min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-1.5 text-sm leading-5 text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="button"
            aria-label={t("ai.assistantSend")}
            disabled={!draft.trim() || loading}
            onClick={() => void send(draft)}
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        </div>
      </footer>
    </div>
  );
}
