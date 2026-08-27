import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { aiExecute } from "../../lib/api";
import type { AiExecuteResponse } from "../../types/api";
import { AiActionResults } from "./AiActionResults";
import { AiSuggestedPrompts, type AiPageContext } from "./AiSuggestedPrompts";

interface AiAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  projectId: string | undefined;
  context: AiPageContext;
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
  context,
}: AiAssistantPanelProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setDraft("");
      // Let the panel mount before focusing so the animation does not swallow it.
      requestAnimationFrame(() => inputRef.current?.focus());
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
    setLoading(true);

    try {
      const result = await aiExecute(workspaceId, projectId, {
        prompt,
        pageContext: context,
      });
      setMessages((prev) => [...prev, { role: "assistant", result }]);
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
          <AiSuggestedPrompts context={context} onPick={send} />
        )}
      </div>

      <footer className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:border-primary/50">
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void send(draft);
            }}
            placeholder={t("ai.assistantPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
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
